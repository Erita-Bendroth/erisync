import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

interface SidebarOrderItem {
  item_key: string;
  order_index: number;
}

interface UseSidebarOrderReturn {
  getSortedItems: <T extends { key: string }>(items: T[]) => T[];
  updateOrder: (itemKeys: string[]) => Promise<void>;
  resetOrder: () => Promise<void>;
  isLoading: boolean;
}

export const useSidebarOrder = (): UseSidebarOrderReturn => {
  const { user } = useAuth();
  const [orderMap, setOrderMap] = useState<SidebarOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's saved order from database
  const fetchOrder = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sidebar_item_order')
        .select('item_key, order_index')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });

      if (error) throw error;

      setOrderMap(data || []);
    } catch (error) {
      console.error('Error fetching sidebar order:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrder();

    // Set up real-time subscription
    const channel = supabase
      .channel('sidebar_order_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sidebar_item_order',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrder, user?.id]);

  // Sort items based on saved order
  const getSortedItems = useCallback(
    <T extends { key: string }>(items: T[]): T[] => {
      if (!orderMap || orderMap.length === 0) {
        return items; // Return default order
      }

      // Create a map of item_key to order_index
      const orderIndexMap = new Map(
        orderMap.map((item) => [item.item_key, item.order_index])
      );

      // Sort items, placing items not in saved order at the end
      return [...items].sort((a, b) => {
        const aIndex = orderIndexMap.get(a.key) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderIndexMap.get(b.key) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
    },
    [orderMap]
  );

  // Update order in database
  const updateOrder = useCallback(
    async (itemKeys: string[]) => {
      if (!user) return;

      try {
        // Delete all existing order
        await supabase
          .from('sidebar_item_order')
          .delete()
          .eq('user_id', user.id);

        // Insert new order
        const orderData = itemKeys.map((key, index) => ({
          user_id: user.id,
          item_key: key,
          order_index: index,
        }));

        const { error } = await supabase
          .from('sidebar_item_order')
          .insert(orderData);

        if (error) throw error;

        toast.success('Sidebar order saved');
      } catch (error) {
        console.error('Error updating sidebar order:', error);
        toast.error('Failed to save sidebar order');
      }
    },
    [user]
  );

  // Reset order (delete saved preferences)
  const resetOrder = useCallback(
    async () => {
      if (!user) return;

      try {
        const { error } = await supabase
          .from('sidebar_item_order')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;

        toast.success('Sidebar reset to default');

        // Refresh order
        fetchOrder();
      } catch (error) {
        console.error('Error resetting sidebar order:', error);
        toast.error('Failed to reset sidebar order');
      }
    },
    [user, fetchOrder]
  );

  return {
    getSortedItems,
    updateOrder,
    resetOrder,
    isLoading,
  };
};
