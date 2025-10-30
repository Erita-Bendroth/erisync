import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamFavorite {
  id: string;
  name: string;
  team_ids: string[];
  created_at: string;
  view_context?: 'schedule' | 'multi-team';
}

export const useTeamFavorites = (viewContext?: 'schedule' | 'multi-team') => {
  const [favorites, setFavorites] = useState<TeamFavorite[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('team_view_favorites')
        .select('*')
        .eq('user_id', user.id);
      
      // Filter by context if provided
      if (viewContext) {
        query = query.eq('view_context', viewContext);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [viewContext]);

  useEffect(() => {
    fetchFavorites();

    // Set up real-time subscription for favorites changes
    const channel = supabase
      .channel('team_favorites_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_view_favorites',
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFavorites]);

  return {
    favorites,
    loading,
    refetchFavorites: fetchFavorites,
  };
};
