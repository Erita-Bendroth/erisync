import { supabase } from '@/integrations/supabase/client';
import { format, isWeekend as isWeekendDate } from 'date-fns';

export interface HolidayInfo {
  date: string;
  isWeekend: boolean;
  isPublicHoliday: boolean;
  holidayName?: string;
  userHasHoliday?: boolean;
}

/**
 * Check if a date is a weekend, public holiday, or user's personal holiday
 */
export async function detectHolidays(
  dates: Date[],
  userIds: string[],
  teamId: string
): Promise<Map<string, Map<string, HolidayInfo>>> {
  // Map structure: dateStr -> userId -> HolidayInfo
  const holidayMap = new Map<string, Map<string, HolidayInfo>>();
  
  if (userIds.length === 0 || dates.length === 0) {
    return holidayMap;
  }

  // Get user locations
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, country_code, region_code')
    .in('user_id', userIds);
  
  const userLocations = new Map(
    profiles?.map(p => [p.user_id, { country: p.country_code, region: p.region_code }]) || []
  );
  
  // Get all public holidays in date range for relevant countries
  const countries = Array.from(new Set(profiles?.map(p => p.country_code).filter(Boolean)));
  const dateStrs = dates.map(d => format(d, 'yyyy-MM-dd'));
  
  let holidays: any[] = [];
  
  if (countries.length > 0) {
    const { data } = await supabase
      .from('holidays')
      .select('date, name, country_code, region_code, user_id')
      .in('date', dateStrs)
      .or(`country_code.in.(${countries.join(',')}),user_id.in.(${userIds.join(',')})`);
    
    holidays = data || [];
  }
  
  // Build holiday map
  for (const date of dates) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const userMap = new Map<string, HolidayInfo>();
    
    for (const userId of userIds) {
      const location = userLocations.get(userId);
      const isWeekend = isWeekendDate(date);
      
      // Check public holidays
      const publicHoliday = holidays?.find(h => 
        h.date === dateStr &&
        h.user_id === null &&
        h.country_code === location?.country &&
        (h.region_code === null || h.region_code === location?.region)
      );
      
      // Check user's personal holiday
      const personalHoliday = holidays?.find(h => 
        h.date === dateStr &&
        h.user_id === userId
      );
      
      userMap.set(userId, {
        date: dateStr,
        isWeekend,
        isPublicHoliday: !!publicHoliday,
        holidayName: publicHoliday?.name || personalHoliday?.name,
        userHasHoliday: !!personalHoliday,
      });
    }
    
    holidayMap.set(dateStr, userMap);
  }
  
  return holidayMap;
}

/**
 * Find the best matching shift definition for a specific date and user
 */
export async function findBestShiftForDate(
  date: Date,
  isWeekendOrHoliday: boolean,
  teamId: string,
  selectedShiftId: string | null,
  weekendOverrideShiftId: string | null
): Promise<string | null> {
  if (!selectedShiftId && !weekendOverrideShiftId) return null;
  
  // If it's a weekend/holiday and we have an override, use it
  if (isWeekendOrHoliday && weekendOverrideShiftId) {
    return weekendOverrideShiftId;
  }
  
  // If it's a weekend/holiday, look for appropriate weekend shift
  if (isWeekendOrHoliday) {
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    
    // Try to find weekend shift for this team with matching day
    const { data: weekendShifts } = await supabase
      .from('shift_time_definitions')
      .select('id, day_of_week, team_id, team_ids')
      .eq('shift_type', 'weekend')
      .or(`team_ids.cs.{${teamId}},team_id.eq.${teamId},and(team_id.is.null,team_ids.is.null)`)
      .order('team_id', { ascending: false, nullsFirst: false }); // Prefer team-specific
    
    if (weekendShifts && weekendShifts.length > 0) {
      // Find shift that matches this day of week
      const matchingShift = weekendShifts.find(s => 
        s.day_of_week === null || s.day_of_week.includes(dayOfWeek)
      );
      
      if (matchingShift) {
        return matchingShift.id;
      }
      
      // Fallback: any weekend shift
      return weekendShifts[0].id;
    }
  }
  
  // For regular days, use the selected shift
  return selectedShiftId;
}
