import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserTimeStats {
  user_id: string;
  year: number;
  vacation_days_used: number;
  vacation_days_allowance: number;
  vacation_days_remaining: number;
  flextime_hours_used: number;
  flextime_hours_allowance: number;
  flextime_hours_remaining: number;
  total_hours_worked: number;
  weekend_shifts: number;
  night_shifts: number;
  holiday_shifts: number;
  total_shifts: number;
  is_override: boolean;
}

interface UseUserTimeStatsProps {
  userIds: string[];
  teamIds?: string[];
  year?: number;
  enabled?: boolean;
}

export const useUserTimeStats = ({
  userIds,
  teamIds,
  year = new Date().getFullYear(),
  enabled = true,
}: UseUserTimeStatsProps) => {
  const [stats, setStats] = useState<Map<string, UserTimeStats>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || userIds.length === 0) {
      setStats(new Map());
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const statsMap = new Map<string, UserTimeStats>();

        // Fetch stats for each user in parallel
        const promises = userIds.map(async (userId) => {
          const { data, error: rpcError } = await supabase.rpc(
            'get_user_time_stats',
            {
              _user_id: userId,
              _team_ids: teamIds || null,
              _year: year,
            }
          );

          if (rpcError) throw rpcError;
          if (data) {
            return { userId, data: data as unknown as UserTimeStats };
          }
          return null;
        });

        const results = await Promise.all(promises);
        
        results.forEach((result) => {
          if (result) {
            statsMap.set(result.userId, result.data);
          }
        });

        setStats(statsMap);
      } catch (err) {
        console.error('Error fetching user time stats:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [JSON.stringify(userIds), JSON.stringify(teamIds), year, enabled]);

  const updateAllowance = async (
    userId: string,
    vacationDays: number,
    flextimeHours: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_time_allowances')
        .upsert({
          user_id: userId,
          year,
          vacation_days_allowance: vacationDays,
          flextime_hours_allowance: flextimeHours,
          is_override: true,
          set_by: user.id,
        });

      if (error) throw error;

      // Refresh stats after update
      const { data, error: rpcError } = await supabase.rpc(
        'get_user_time_stats',
        {
          _user_id: userId,
          _team_ids: teamIds || null,
          _year: year,
        }
      );

      if (rpcError) throw rpcError;
      if (data) {
        setStats(prev => new Map(prev).set(userId, data as unknown as UserTimeStats));
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating allowance:', err);
      throw err;
    }
  };

  return { stats, loading, error, updateAllowance };
};
