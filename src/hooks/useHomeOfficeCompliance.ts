import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export interface HomeOfficeLimit {
  id: string;
  country_code: string;
  limit_type: 'weekly' | 'monthly' | 'yearly';
  max_days: number;
  notes: string | null;
}

export interface HomeOfficeCompliance {
  limitType: 'weekly' | 'monthly' | 'yearly' | 'none';
  maxDays: number;
  currentPeriodDays: number;
  periodLabel: string;
  yearToDateDays: number;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  percentUsed: number;
  countryCode: string | null;
}

interface UseHomeOfficeComplianceOptions {
  userId: string;
  countryCode?: string | null;
  referenceDate?: Date;
}

export function useHomeOfficeCompliance({ 
  userId, 
  countryCode: providedCountryCode,
  referenceDate = new Date() 
}: UseHomeOfficeComplianceOptions) {
  const [compliance, setCompliance] = useState<HomeOfficeCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<HomeOfficeLimit | null>(null);

  const fetchCompliance = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get user's country code if not provided
      let countryCode = providedCountryCode;
      if (!countryCode) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country_code')
          .eq('user_id', userId)
          .single();
        countryCode = profile?.country_code;
      }

      if (!countryCode) {
        setCompliance({
          limitType: 'none',
          maxDays: 0,
          currentPeriodDays: 0,
          periodLabel: '',
          yearToDateDays: 0,
          isOverLimit: false,
          isApproachingLimit: false,
          percentUsed: 0,
          countryCode: null,
        });
        setLoading(false);
        return;
      }

      // Fetch the HO limit for this country
      const { data: limitData } = await supabase
        .from('home_office_limits')
        .select('*')
        .eq('country_code', countryCode)
        .maybeSingle();

      setLimit(limitData as HomeOfficeLimit | null);

      // Calculate date ranges based on limit type
      const now = referenceDate;
      let periodStart: string;
      let periodEnd: string;
      let periodLabel: string;

      if (limitData?.limit_type === 'weekly') {
        periodStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        periodEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
        periodLabel = `Week ${format(now, 'w')}`;
      } else if (limitData?.limit_type === 'monthly') {
        periodStart = format(startOfMonth(now), 'yyyy-MM-dd');
        periodEnd = format(endOfMonth(now), 'yyyy-MM-dd');
        periodLabel = format(now, 'MMMM');
      } else {
        periodStart = format(startOfYear(now), 'yyyy-MM-dd');
        periodEnd = format(endOfYear(now), 'yyyy-MM-dd');
        periodLabel = format(now, 'yyyy');
      }

      // Count HO days in current period from daily_time_entries ONLY (source of truth)
      // schedule_entries are synced FROM daily_time_entries, so we only count the source
      const { count: periodCount } = await supabase
        .from('daily_time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('entry_type', 'home_office')
        .gte('entry_date', periodStart)
        .lte('entry_date', periodEnd);

      const currentPeriodDays = periodCount || 0;

      // Count year-to-date HO days from daily_time_entries ONLY
      const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');

      const { count: ytdCount } = await supabase
        .from('daily_time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('entry_type', 'home_office')
        .gte('entry_date', yearStart)
        .lte('entry_date', yearEnd);

      const yearToDateDays = ytdCount || 0;

      // Calculate compliance status
      const maxDays = limitData?.max_days || 0;
      const percentUsed = maxDays > 0 ? (currentPeriodDays / maxDays) * 100 : 0;
      const isOverLimit = maxDays > 0 && currentPeriodDays > maxDays;
      const isApproachingLimit = maxDays > 0 && percentUsed >= 80 && !isOverLimit;

      setCompliance({
        limitType: (limitData?.limit_type as 'weekly' | 'monthly' | 'yearly') || 'none',
        maxDays,
        currentPeriodDays,
        periodLabel,
        yearToDateDays,
        isOverLimit,
        isApproachingLimit,
        percentUsed,
        countryCode,
      });

    } catch (error) {
      console.error('Error fetching HO compliance:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, providedCountryCode, referenceDate]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  return {
    compliance,
    limit,
    loading,
    refresh: fetchCompliance,
  };
}

// Hook for fetching all HO limits (for admin page)
export function useHomeOfficeLimits() {
  const [limits, setLimits] = useState<HomeOfficeLimit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('home_office_limits')
        .select('*')
        .order('country_code');

      if (error) throw error;
      setLimits((data as HomeOfficeLimit[]) || []);
    } catch (error) {
      console.error('Error fetching HO limits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const saveLimit = async (limit: Partial<HomeOfficeLimit> & { country_code: string }) => {
    try {
      const { error } = await supabase
        .from('home_office_limits')
        .upsert({
          country_code: limit.country_code,
          limit_type: limit.limit_type,
          max_days: limit.max_days,
          notes: limit.notes,
        }, {
          onConflict: 'country_code',
        });

      if (error) throw error;
      await fetchLimits();
      return true;
    } catch (error) {
      console.error('Error saving HO limit:', error);
      return false;
    }
  };

  const deleteLimit = async (countryCode: string) => {
    try {
      const { error } = await supabase
        .from('home_office_limits')
        .delete()
        .eq('country_code', countryCode);

      if (error) throw error;
      await fetchLimits();
      return true;
    } catch (error) {
      console.error('Error deleting HO limit:', error);
      return false;
    }
  };

  return {
    limits,
    loading,
    refresh: fetchLimits,
    saveLimit,
    deleteLimit,
  };
}
