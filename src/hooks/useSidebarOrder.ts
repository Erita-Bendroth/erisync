import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

interface SidebarOrderItem {
  item_key: string;
  order_index: number;
}

interface UseSidebarOrderReturn {
  getSortedItems: <T extends { key: string }>(items: T[], section: string) => T[];
  updateOrder: (section: string, itemKeys: string[]) => Promise<void>;
  resetOrder: (section?: string) => Promise<void>;
  isReorderMode: boolean;
  setIsReorderMode: (value: boolean) => void;
  isLoading: boolean;
}

export const useSidebarOrder = (): UseSidebarOrderReturn => {
  const { user } = useAuth();
  const [orderMap, setOrderMap] = useState<Record<string, SidebarOrderItem[]>>({});
  const [isReorderMode, setIsReorderMode] = useState(false);
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
        .select('section, item_key, order_index')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Group by section
      const grouped: Record<string, SidebarOrderItem[]> = {};
      data?.forEach((item) => {
        if (!grouped[item.section]) {
          grouped[item.section] = [];
        }
        grouped[item.section].push({
          item_key: item.item_key,
          order_index: item.order_index,
        });
      });

      setOrderMap(grouped);
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
    <T extends { key: string }>(items: T[], section: string): T[] => {
      const savedOrder = orderMap[section];
      if (!savedOrder || savedOrder.length === 0) {
        return items; // Return default order
      }

      // Create a map of item_key to order_index
      const orderIndexMap = new Map(
        savedOrder.map((item) => [item.item_key, item.order_index])
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
    async (section: string, itemKeys: string[]) => {
      if (!user) return;

      try {
        // Delete existing order for this section
        await supabase
          .from('sidebar_item_order')
          .delete()
          .eq('user_id', user.id)
          .eq('section', section);

        // Insert new order
        const orderData = itemKeys.map((key, index) => ({
          user_id: user.id,
          section,
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
    async (section?: string) => {
      if (!user) return;

      try {
        let query = supabase
          .from('sidebar_item_order')
          .delete()
          .eq('user_id', user.id);

        if (section) {
          query = query.eq('section', section);
        }

        const { error } = await query;

        if (error) throw error;

        toast.success(
          section
            ? `${section} section reset to default`
            : 'Sidebar reset to default'
        );

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
    isReorderMode,
    setIsReorderMode,
    isLoading,
  };
};
