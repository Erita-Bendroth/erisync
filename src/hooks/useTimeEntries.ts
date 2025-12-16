import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { calculateFlexTime, type EntryType } from '@/lib/flexTimeUtils';

export interface DailyTimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  work_start_time: string | null;
  work_end_time: string | null;
  break_duration_minutes: number;
  target_hours: number;
  actual_hours_worked: number | null;
  flextime_delta: number | null;
  entry_type: string;
  comment: string | null;
  schedule_entry_id: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyFlexSummary {
  id: string;
  user_id: string;
  year: number;
  month: number;
  starting_balance: number;
  month_delta: number;
  ending_balance: number;
  is_finalized: boolean;
}

export interface TimeEntryInput {
  entry_date: string;
  work_start_time: string | null;
  work_end_time: string | null;
  break_duration_minutes: number;
  entry_type: string;
  comment?: string | null;
  schedule_entry_id?: string | null;
}

export function useTimeEntries(monthDate: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyTimeEntry[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFlexSummary | null>(null);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [carryoverLimit, setCarryoverLimit] = useState<number>(40);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // Fetch time entries for the month
      const { data: entriesData, error: entriesError } = await supabase
        .from('daily_time_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: true });

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Fetch current month summary
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      
      const { data: summaryData, error: summaryError } = await supabase
        .from('monthly_flextime_summary')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (summaryError) throw summaryError;
      setMonthlySummary(summaryData);

      // Fetch previous month's ending balance
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      
      const { data: prevSummary } = await supabase
        .from('monthly_flextime_summary')
        .select('ending_balance')
        .eq('user_id', user.id)
        .eq('year', prevYear)
        .eq('month', prevMonth)
        .maybeSingle();

      setPreviousBalance(prevSummary?.ending_balance || 0);

      // Fetch user profile for carryover limit and name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, flextime_carryover_limit')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setCarryoverLimit(profileData.flextime_carryover_limit ?? 40);
        setUserName(`${profileData.first_name} ${profileData.last_name}`);
      }

    } catch (error) {
      console.error('Error fetching time entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load time entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, monthDate, toast]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntry = useCallback(async (input: TimeEntryInput): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const entryDate = new Date(input.entry_date);
      const calculation = calculateFlexTime(entryDate, {
        workStartTime: input.work_start_time,
        workEndTime: input.work_end_time,
        breakDurationMinutes: input.break_duration_minutes,
        entryType: input.entry_type,
      });

      const entryData = {
        user_id: user.id,
        entry_date: input.entry_date,
        work_start_time: input.work_start_time,
        work_end_time: input.work_end_time,
        break_duration_minutes: input.break_duration_minutes,
        target_hours: calculation.targetHours,
        actual_hours_worked: calculation.actualHours,
        flextime_delta: calculation.flexDelta,
        entry_type: input.entry_type,
        comment: input.comment || null,
        schedule_entry_id: input.schedule_entry_id || null,
      };

      // Upsert the entry
      const { error } = await supabase
        .from('daily_time_entries')
        .upsert(entryData, { 
          onConflict: 'user_id,entry_date',
        });

      if (error) throw error;

      // Update monthly summary
      await updateMonthlySummary();

      toast({
        title: 'Saved',
        description: 'Time entry saved successfully',
      });

      await fetchEntries();
      return true;

    } catch (error) {
      console.error('Error saving time entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to save time entry',
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, toast, fetchEntries]);

  const deleteEntry = useCallback(async (entryDate: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('daily_time_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      if (error) throw error;

      await updateMonthlySummary();
      await fetchEntries();

      toast({
        title: 'Deleted',
        description: 'Time entry deleted',
      });

      return true;
    } catch (error) {
      console.error('Error deleting time entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete time entry',
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, toast, fetchEntries]);

  const updateMonthlySummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // Get all entries for the month to calculate delta
      const { data: monthEntries } = await supabase
        .from('daily_time_entries')
        .select('flextime_delta')
        .eq('user_id', user.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      const monthDelta = (monthEntries || []).reduce(
        (sum, entry) => sum + (entry.flextime_delta || 0),
        0
      );

      // Get previous month's ending balance
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      
      const { data: prevSummary } = await supabase
        .from('monthly_flextime_summary')
        .select('ending_balance')
        .eq('user_id', user.id)
        .eq('year', prevYear)
        .eq('month', prevMonth)
        .maybeSingle();

      const startingBalance = prevSummary?.ending_balance || 0;
      const endingBalance = startingBalance + monthDelta;

      // Upsert the monthly summary
      await supabase
        .from('monthly_flextime_summary')
        .upsert({
          user_id: user.id,
          year,
          month,
          starting_balance: startingBalance,
          month_delta: monthDelta,
          ending_balance: endingBalance,
        }, {
          onConflict: 'user_id,year,month',
        });

    } catch (error) {
      console.error('Error updating monthly summary:', error);
    }
  }, [user?.id, monthDate]);

  const saveCarryoverLimit = useCallback(async (newLimit: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ flextime_carryover_limit: newLimit })
        .eq('user_id', user.id);

      if (error) throw error;

      setCarryoverLimit(newLimit);
      toast({
        title: 'Saved',
        description: 'Carryover limit updated successfully',
      });

      return true;
    } catch (error) {
      console.error('Error saving carryover limit:', error);
      toast({
        title: 'Error',
        description: 'Failed to save carryover limit',
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, toast]);

  const getEntryForDate = useCallback((dateStr: string): DailyTimeEntry | undefined => {
    return entries.find(e => e.entry_date === dateStr);
  }, [entries]);

  // Calculate current month's total flex
  const currentMonthDelta = entries.reduce(
    (sum, entry) => sum + (entry.flextime_delta || 0),
    0
  );

  const currentBalance = previousBalance + currentMonthDelta;

  return {
    entries,
    monthlySummary,
    previousBalance,
    currentMonthDelta,
    currentBalance,
    carryoverLimit,
    userName,
    loading,
    saveEntry,
    deleteEntry,
    getEntryForDate,
    saveCarryoverLimit,
    refresh: fetchEntries,
  };
}
