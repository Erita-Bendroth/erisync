import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useHolidayVisibility(userId: string | undefined) {
  const [showHolidays, setShowHolidays] = useState(true); // Default: show holidays
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    loadPreference();
  }, [userId]);

  const loadPreference = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('show_holidays_default')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setShowHolidays(data.show_holidays_default ?? true);
      }
    } catch (error) {
      console.error('Error loading holiday visibility preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleHolidays = async () => {
    const newValue = !showHolidays;
    setShowHolidays(newValue);

    if (!userId) return;

    try {
      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert({
          user_id: userId,
          show_holidays_default: newValue,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving holiday visibility preference:', error);
      // Revert on error
      setShowHolidays(!newValue);
    }
  };

  return {
    showHolidays,
    toggleHolidays,
    loading,
  };
}
