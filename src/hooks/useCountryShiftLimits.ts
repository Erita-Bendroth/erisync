import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CountryShiftLimit {
  id: string;
  country_code: string;
  shift_type: string;
  max_shifts_per_year: number;
  year: number;
  partnership_id: string | null;
  notes: string | null;
}

export interface ShiftLimitUsage {
  shift_type: string;
  max_allowed: number;
  used: number;
  remaining: number;
  percentage: number;
  isExceeded: boolean;
  isNearLimit: boolean;
}

export interface CountryShiftLimitsResult {
  limits: CountryShiftLimit[];
  usage: ShiftLimitUsage[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCountryShiftLimits(
  userId: string | null,
  countryCode: string | null,
  year: number = new Date().getFullYear(),
  teamIds?: string[]
): CountryShiftLimitsResult {
  const [limits, setLimits] = useState<CountryShiftLimit[]>([]);
  const [usage, setUsage] = useState<ShiftLimitUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId || !countryCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch limits for this country and year
      const { data: limitData, error: limitError } = await supabase
        .from('country_shift_limits')
        .select('*')
        .eq('country_code', countryCode)
        .eq('year', year);

      if (limitError) throw limitError;

      setLimits(limitData || []);

      if (!limitData || limitData.length === 0) {
        setUsage([]);
        setLoading(false);
        return;
      }

      // Fetch user's shift counts for the year
      const { data: shiftCounts, error: countError } = await supabase.rpc(
        'get_user_shift_counts',
        {
          _user_ids: [userId],
          _team_ids: teamIds || null,
          _start_date: `${year}-01-01`,
          _end_date: `${year}-12-31`,
        }
      );

      if (countError) throw countError;

      const userCounts = shiftCounts?.[0] || {
        weekend_shifts_count: 0,
        night_shifts_count: 0,
        holiday_shifts_count: 0,
        total_shifts_count: 0,
      };

      // Map limits to usage
      const usageResult: ShiftLimitUsage[] = limitData.map((limit) => {
        let used = 0;
        
        switch (limit.shift_type) {
          case 'weekend':
            used = userCounts.weekend_shifts_count || 0;
            break;
          case 'late':
          case 'early':
          case 'night':
            used = userCounts.night_shifts_count || 0;
            break;
          case 'holiday':
            used = userCounts.holiday_shifts_count || 0;
            break;
          case 'overtime':
            // Overtime is typically weekend + holiday shifts combined
            used = (userCounts.weekend_shifts_count || 0) + (userCounts.holiday_shifts_count || 0);
            break;
          default:
            used = 0;
        }

        const remaining = Math.max(0, limit.max_shifts_per_year - used);
        const percentage = Math.round((used / limit.max_shifts_per_year) * 100);

        return {
          shift_type: limit.shift_type,
          max_allowed: limit.max_shifts_per_year,
          used,
          remaining,
          percentage,
          isExceeded: used > limit.max_shifts_per_year,
          isNearLimit: percentage >= 80 && percentage < 100,
        };
      });

      setUsage(usageResult);
    } catch (err: any) {
      console.error('Error fetching country shift limits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, countryCode, year, teamIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    limits,
    usage,
    loading,
    error,
    refetch: fetchData,
  };
}

// Helper hook to check if a specific action would exceed limits
export function useShiftLimitCheck() {
  const checkLimit = useCallback(
    async (
      userId: string,
      countryCode: string,
      shiftType: string,
      additionalCount: number = 1,
      year: number = new Date().getFullYear()
    ): Promise<{ wouldExceed: boolean; current: number; max: number; afterAction: number }> => {
      try {
        // Fetch limit for this country, shift type, and year
        const { data: limits, error: limitError } = await supabase
          .from('country_shift_limits')
          .select('max_shifts_per_year')
          .eq('country_code', countryCode)
          .eq('shift_type', shiftType)
          .eq('year', year)
          .limit(1);

        if (limitError) throw limitError;

        if (!limits || limits.length === 0) {
          // No limit configured
          return { wouldExceed: false, current: 0, max: Infinity, afterAction: 0 };
        }

        const maxAllowed = limits[0].max_shifts_per_year;

        // Fetch current usage
        const { data: shiftCounts, error: countError } = await supabase.rpc(
          'get_user_shift_counts',
          {
            _user_ids: [userId],
            _team_ids: null,
            _start_date: `${year}-01-01`,
            _end_date: `${year}-12-31`,
          }
        );

        if (countError) throw countError;

        const userCounts = shiftCounts?.[0] as {
          weekend_shifts_count?: number;
          night_shifts_count?: number;
          holiday_shifts_count?: number;
        } || {};
        let currentUsed = 0;

        switch (shiftType) {
          case 'weekend':
            currentUsed = userCounts.weekend_shifts_count || 0;
            break;
          case 'late':
          case 'early':
          case 'night':
            currentUsed = userCounts.night_shifts_count || 0;
            break;
          case 'holiday':
            currentUsed = userCounts.holiday_shifts_count || 0;
            break;
          case 'overtime':
            currentUsed = (userCounts.weekend_shifts_count || 0) + (userCounts.holiday_shifts_count || 0);
            break;
        }

        const afterAction = currentUsed + additionalCount;

        return {
          wouldExceed: afterAction > maxAllowed,
          current: currentUsed,
          max: maxAllowed,
          afterAction,
        };
      } catch (error) {
        console.error('Error checking shift limit:', error);
        return { wouldExceed: false, current: 0, max: Infinity, afterAction: 0 };
      }
    },
    []
  );

  return { checkLimit };
}
