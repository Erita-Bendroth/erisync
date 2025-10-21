import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShiftCounts {
  user_id: string;
  weekend_shifts_count: number;
  night_shifts_count: number;
  holiday_shifts_count: number;
  total_shifts_count: number;
}

interface UseShiftCountsProps {
  userIds: string[];
  teamIds?: string[];
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

export const useShiftCounts = ({
  userIds,
  teamIds,
  startDate,
  endDate,
  enabled = true,
}: UseShiftCountsProps) => {
  const [shiftCounts, setShiftCounts] = useState<ShiftCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || userIds.length === 0) {
      setShiftCounts([]);
      return;
    }

    const fetchShiftCounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_user_shift_counts', {
          _user_ids: userIds,
          _team_ids: teamIds || null,
          _start_date: startDate || null,
          _end_date: endDate || null,
        });

        if (rpcError) throw rpcError;

        // Fill in missing users with zero counts
        const countsMap = new Map(data?.map((c: any) => [c.user_id, c]) || []);
        const completeData = userIds.map((userId) => 
          countsMap.get(userId) || {
            user_id: userId,
            weekend_shifts_count: 0,
            night_shifts_count: 0,
            holiday_shifts_count: 0,
            total_shifts_count: 0,
          }
        );

        setShiftCounts(completeData);
      } catch (err) {
        console.error('Error fetching shift counts:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchShiftCounts();
  }, [JSON.stringify(userIds), JSON.stringify(teamIds), startDate, endDate, enabled]);

  return { shiftCounts, loading, error };
};
