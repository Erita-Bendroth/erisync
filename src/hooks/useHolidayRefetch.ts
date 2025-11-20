import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that provides a trigger value that changes when holidays are modified
 * Components can include this in their useEffect dependencies to auto-refetch
 */
export function useHolidayRefetch() {
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel('holidays-refetch-trigger')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'holidays'
        },
        () => {
          // Increment trigger to cause dependent useEffects to re-run
          setRefetchTrigger(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return refetchTrigger;
}
