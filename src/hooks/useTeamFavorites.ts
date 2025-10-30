import { useState, useEffect } from 'react';
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

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use RPC or direct query to avoid type inference issues
      const query = supabase
        .from('team_view_favorites')
        .select('*')
        .eq('user_id', user.id);

      // @ts-ignore - Temporary until Supabase types are regenerated
      const finalQuery = viewContext ? query.eq('view_context', viewContext) : query;
      
      // @ts-ignore - Temporary until Supabase types are regenerated
      const { data, error } = await finalQuery.order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();

    // Set up real-time subscription for favorites changes
    const channel = supabase
      .channel(`team_favorites_changes_${viewContext || 'all'}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewContext]);

  return {
    favorites,
    loading,
    refetchFavorites: fetchFavorites,
  };
};
