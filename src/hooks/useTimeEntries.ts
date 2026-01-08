import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { calculateFlexTime, ENTRY_TYPE_LABELS, type EntryType } from '@/lib/flexTimeUtils';

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
  fza_hours: number | null;
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
  fza_hours?: number | null;
}

export function useTimeEntries(monthDate: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyTimeEntry[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFlexSummary | null>(null);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [carryoverLimit, setCarryoverLimit] = useState<number>(40);
  const [initialBalance, setInitialBalance] = useState<number>(0);
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

      // Fetch user profile for carryover limit, initial balance, and name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, flextime_carryover_limit, initial_flextime_balance')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setCarryoverLimit(profileData.flextime_carryover_limit ?? 40);
        setInitialBalance(profileData.initial_flextime_balance ?? 0);
        setUserName(`${profileData.first_name} ${profileData.last_name}`);
      }

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

      // Use initial_flextime_balance if no previous month summary exists
      const prevBalance = prevSummary?.ending_balance ?? (profileData?.initial_flextime_balance ?? 0);
      setPreviousBalance(prevBalance);

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
        fzaHours: input.fza_hours,
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
        fza_hours: input.fza_hours || null,
      };

      // Check if there's an existing entry to see if entry_type is changing
      const { data: existingEntry } = await supabase
        .from('daily_time_entries')
        .select('entry_type')
        .eq('user_id', user.id)
        .eq('entry_date', input.entry_date)
        .maybeSingle();

      // Define entry type categories
      const unavailableTypes: EntryType[] = ['public_holiday', 'sick_leave', 'vacation', 'fza_withdrawal'];
      const wasHomeOffice = existingEntry?.entry_type === 'home_office';
      const isHomeOffice = input.entry_type === 'home_office';
      const wasUnavailableType = existingEntry && unavailableTypes.includes(existingEntry.entry_type as EntryType);
      const isUnavailableType = unavailableTypes.includes(input.entry_type as EntryType);

      // Upsert the entry
      const { error } = await supabase
        .from('daily_time_entries')
        .upsert(entryData, { 
          onConflict: 'user_id,entry_date',
        });

      if (error) throw error;

      // Get user's team for schedule_entries sync
      const { data: teamMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (teamMembership?.team_id) {
        const isWorkEntry = input.entry_type === 'work' && input.work_start_time && input.work_end_time;
        const wasWorkEntry = existingEntry?.entry_type === 'work';
        
        if (isWorkEntry) {
          // Sync regular work entries to schedule_entries for Team Availability visibility
          const timeNote = `Work ${input.work_start_time?.slice(0,5)}-${input.work_end_time?.slice(0,5)}${input.comment ? ': ' + input.comment : ''}`;
          await supabase
            .from('schedule_entries')
            .upsert({
              user_id: user.id,
              team_id: teamMembership.team_id,
              date: input.entry_date,
              activity_type: 'work',
              shift_type: 'normal',
              availability_status: 'available',
              created_by: user.id,
              notes: timeNote,
            }, {
              onConflict: 'user_id,date,team_id',
            });
        } else if (isHomeOffice) {
          // Sync home_office entries to schedule_entries for manager visibility
          await supabase
            .from('schedule_entries')
            .upsert({
              user_id: user.id,
              team_id: teamMembership.team_id,
              date: input.entry_date,
              activity_type: 'working_from_home',
              shift_type: 'normal',
              availability_status: 'available',
              created_by: user.id,
              notes: input.comment || null,
            }, {
              onConflict: 'user_id,date,team_id',
            });
        } else if (isUnavailableType) {
          // Sync public_holiday, sick_leave, vacation, fza_withdrawal as unavailable
          const entryLabel = ENTRY_TYPE_LABELS[input.entry_type as EntryType] || input.entry_type;
          await supabase
            .from('schedule_entries')
            .upsert({
              user_id: user.id,
              team_id: teamMembership.team_id,
              date: input.entry_date,
              activity_type: 'out_of_office',
              shift_type: null,
              availability_status: 'unavailable',
              created_by: user.id,
              notes: `${entryLabel}${input.comment ? ': ' + input.comment : ''}`,
            }, {
              onConflict: 'user_id,date,team_id',
            });
        } else if ((wasHomeOffice || wasUnavailableType || wasWorkEntry) && !isHomeOffice && !isUnavailableType && !isWorkEntry) {
          // Entry type changed FROM synced type to non-synced type - remove schedule entry
          await supabase
            .from('schedule_entries')
            .delete()
            .eq('user_id', user.id)
            .eq('date', input.entry_date)
            .eq('team_id', teamMembership.team_id)
            .in('activity_type', ['working_from_home', 'out_of_office', 'work']);
        }
      }

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
      // Check entry type before deleting
      const { data: existingEntry } = await supabase
        .from('daily_time_entries')
        .select('entry_type')
        .eq('user_id', user.id)
        .eq('entry_date', entryDate)
        .maybeSingle();

      const { error } = await supabase
        .from('daily_time_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('entry_date', entryDate);

      if (error) throw error;

      // Entry types that sync to schedule_entries
      const syncedTypes: EntryType[] = ['work', 'home_office', 'public_holiday', 'sick_leave', 'vacation', 'fza_withdrawal'];
      
      // If entry was a synced type, remove the schedule_entry
      if (existingEntry && syncedTypes.includes(existingEntry.entry_type as EntryType)) {
        const { data: teamMembership } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (teamMembership?.team_id) {
          // Delete the synced schedule entry
          await supabase
            .from('schedule_entries')
            .delete()
            .eq('user_id', user.id)
            .eq('date', entryDate)
            .eq('team_id', teamMembership.team_id)
            .in('activity_type', ['working_from_home', 'out_of_office', 'work']);
        }
      }

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

      // If no previous summary, use initial balance from profile
      let startingBalance = prevSummary?.ending_balance ?? 0;
      if (!prevSummary) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('initial_flextime_balance')
          .eq('user_id', user.id)
          .single();
        startingBalance = profile?.initial_flextime_balance ?? 0;
      }
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

  const saveFlexTimeSettings = useCallback(async (newLimit: number, newInitialBalance: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          flextime_carryover_limit: newLimit,
          initial_flextime_balance: newInitialBalance,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setCarryoverLimit(newLimit);
      setInitialBalance(newInitialBalance);
      
      // Recalculate monthly summary with new initial balance
      await updateMonthlySummary();
      await fetchEntries();

      toast({
        title: 'Saved',
        description: 'FlexTime settings updated successfully',
      });

      return true;
    } catch (error) {
      console.error('Error saving flextime settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save FlexTime settings',
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, toast, updateMonthlySummary, fetchEntries]);

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
    initialBalance,
    userName,
    loading,
    saveEntry,
    deleteEntry,
    getEntryForDate,
    saveFlexTimeSettings,
    refresh: fetchEntries,
  };
}
