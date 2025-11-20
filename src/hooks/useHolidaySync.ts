import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to sync holidays in realtime across all users
 * Invalidates React Query cache when holidays are imported/deleted
 */
export function useHolidaySync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔄 Setting up holiday realtime subscription');

    const channel = supabase
      .channel('holidays-sync')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'holidays'
        },
        (payload) => {
          console.log('📅 Holiday change detected:', payload.eventType);
          
          // Invalidate all holiday queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['holidays'] });
          
          // Also invalidate schedule queries since holidays affect schedule display
          queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
          queryClient.invalidateQueries({ queryKey: ['schedule'] });
          
          // Show notification
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Holidays Updated",
              description: "New holidays have been imported and synced to your view",
            });
          } else if (payload.eventType === 'DELETE') {
            toast({
              title: "Holidays Updated", 
              description: "Holidays have been removed and synced to your view",
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Holiday sync subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Holiday sync error');
        }
      });

    return () => {
      console.log('🔌 Cleaning up holiday subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);
}
