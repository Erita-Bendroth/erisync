import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export function usePendingRequestsCount() {
  const { user } = useAuth();
  const [pendingVacations, setPendingVacations] = useState(0);
  const [pendingSwaps, setPendingSwaps] = useState(0);

  const fetchPendingCounts = async () => {
    if (!user) return;

    try {
      // Fetch pending vacation requests
      const { count: vacationCount } = await supabase
        .from('vacation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      setPendingVacations(vacationCount || 0);

      // Fetch pending swap requests (both as requester and target)
      const { count: swapCount } = await supabase
        .from('shift_swap_requests')
        .select('*', { count: 'exact', head: true })
        .or(`requesting_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
        .eq('status', 'pending');

      setPendingSwaps(swapCount || 0);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  useEffect(() => {
    fetchPendingCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('pending-requests-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vacation_requests' },
        fetchPendingCounts
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_swap_requests' },
        fetchPendingCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    total: pendingVacations + pendingSwaps,
    pendingVacations,
    pendingSwaps,
  };
}
