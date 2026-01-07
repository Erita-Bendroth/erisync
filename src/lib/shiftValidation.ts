import { isWeekend as isWeekendDate } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];

interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates if a weekend shift can be assigned to a specific date
 * Weekend shifts are only allowed on actual weekends (Sat/Sun) or public holidays
 */
export async function validateWeekendShift(
  shiftType: ShiftType | null,
  date: string,
  countryCode?: string | null
): Promise<ValidationResult> {
  // Only validate weekend shifts - other shifts are always valid
  if (!shiftType || shiftType !== 'weekend') {
    return { isValid: true };
  }

  const dateObj = new Date(date);
  
  // Check if it's an actual weekend (Saturday or Sunday)
  if (isWeekendDate(dateObj)) {
    return { isValid: true };
  }

  // Check if it's a public holiday
  const { data: holidays } = await supabase
    .from('holidays')
    .select('id, name, country_code')
    .eq('date', date)
    .eq('is_public', true)
    .is('user_id', null);
  
  if (holidays && holidays.length > 0) {
    // If country code provided, check for matching country holiday
    if (countryCode) {
      const matchingHoliday = holidays.find(h => h.country_code === countryCode);
      if (matchingHoliday) {
        return { isValid: true };
      }
    } else {
      // No country code, any public holiday is valid
      return { isValid: true };
    }
  }

  // Not a weekend and not a holiday - invalid
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  return { 
    isValid: false, 
    errorMessage: `Weekend shifts can only be assigned on weekends or public holidays. ${dayName} is a regular weekday.`
  };
}

/**
 * Synchronous check for filtering UI options
 * Doesn't check holidays - use for quick UI filtering only
 */
export function isDateWeekend(date: string): boolean {
  const dateObj = new Date(date);
  return isWeekendDate(dateObj);
}
