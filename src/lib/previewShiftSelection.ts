import { supabase } from "@/integrations/supabase/client";

export interface ShiftTimeDefinition {
  id: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  description: string | null;
  day_of_week: number[] | null;
  team_id: string | null;
  team_ids: string[] | null;
  region_code: string | null;
}

export interface DayShiftPreview {
  date: Date;
  shiftId: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  description: string;
  isWeekend: boolean;
  isAlternative: boolean;
}

/**
 * Fetches all shift definitions for a team
 */
export async function fetchTeamShiftDefinitions(teamId: string): Promise<ShiftTimeDefinition[]> {
  console.log('🔍 [PREVIEW DEBUG] Fetching shift definitions for team:', teamId);
  
  const { data, error } = await supabase
    .from('shift_time_definitions')
    .select('*')
    .or(`team_id.eq.${teamId},team_ids.cs.{${teamId}},and(team_id.is.null,team_ids.is.null)`);

  if (error) {
    console.error('❌ [PREVIEW DEBUG] Error fetching shift definitions:', error);
    return [];
  }

  console.log(`✅ [PREVIEW DEBUG] Fetched ${data?.length || 0} shift definitions:`, 
    data?.map(s => ({
      id: s.id.substring(0, 8),
      type: s.shift_type,
      times: `${s.start_time}-${s.end_time}`,
      days: s.day_of_week,
      desc: s.description
    }))
  );

  return data || [];
}

/**
 * Determines which shift will be used for a specific date
 * Mirrors the logic in bulkSchedulerUtils.ts findBestShiftForDate
 */
export function getShiftForDate(
  date: Date,
  selectedShiftType: string,
  autoDetectWeekends: boolean,
  weekendOverrideShiftId: string | null,
  allShifts: ShiftTimeDefinition[]
): DayShiftPreview {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  console.log(`\n📅 [PREVIEW DEBUG] ${dateStr}`);
  console.log(`   dayOfWeek: ${dayOfWeek}, isWeekend: ${isWeekend}, autoDetectWeekends: ${autoDetectWeekends}`);
  console.log(`   selectedShiftType: "${selectedShiftType}"`);
  console.log(`   Total shifts available: ${allShifts.length}`);

  // If weekend detection is on and it's a weekend, use weekend shift
  if (autoDetectWeekends && isWeekend) {
    console.log('   🔍 Looking for weekend shift...');
    const weekendShifts = allShifts.filter(s => s.shift_type === 'weekend');
    console.log(`   Found ${weekendShifts.length} weekend shifts:`, 
      weekendShifts.map(s => `${s.description} (${s.start_time}-${s.end_time})`));
    
    const weekendShift = weekendShifts[0];
    
    if (weekendShift) {
      console.log(`   ✅ Selected weekend shift: ${weekendShift.description} (${weekendShift.start_time}-${weekendShift.end_time})`);
      return {
        date,
        shiftId: weekendShift.id,
        shiftType: weekendShift.shift_type,
        startTime: weekendShift.start_time,
        endTime: weekendShift.end_time,
        description: weekendShift.description || 'Weekend shift',
        isWeekend: true,
        isAlternative: false,
      };
    } else {
      console.log('   ⚠️ No weekend shift found, will use regular shift');
    }
  }

  // Find all shifts matching the selected shift type
  console.log(`   🔍 Looking for shifts of type "${selectedShiftType}"...`);
  const matchingShifts = allShifts.filter(s => s.shift_type === selectedShiftType);
  console.log(`   Found ${matchingShifts.length} shifts:`, 
    matchingShifts.map(s => ({
      desc: s.description,
      times: `${s.start_time}-${s.end_time}`,
      days: s.day_of_week
    })));

  if (matchingShifts.length === 0) {
    console.log('   ⚠️ No matching shifts, using fallback');
    // Fallback if no shifts match the type
    const fallbackShift = allShifts[0];
    return {
      date,
      shiftId: fallbackShift?.id || 'unknown',
      shiftType: fallbackShift?.shift_type || 'normal',
      startTime: fallbackShift?.start_time || '08:00',
      endTime: fallbackShift?.end_time || '16:00',
      description: fallbackShift?.description || 'Default shift',
      isWeekend: false,
      isAlternative: true,
    };
  }

  // Filter shifts that are valid for this day of week
  console.log(`   🔍 Filtering by day_of_week (${dayOfWeek})...`);
  const validShiftsForDay = matchingShifts.filter(s => 
    !s.day_of_week || 
    s.day_of_week.length === 0 || 
    s.day_of_week.includes(dayOfWeek)
  );
  console.log(`   Found ${validShiftsForDay.length} valid shifts for this day:`,
    validShiftsForDay.map(s => ({
      desc: s.description,
      times: `${s.start_time}-${s.end_time}`,
      days: s.day_of_week
    })));

  if (validShiftsForDay.length > 0) {
    // Use the first valid shift (prefer team-specific, then day-specific)
    const bestShift = validShiftsForDay[0];
    
    // Check if this is an alternative (day-specific) shift
    const isAlternative = bestShift.day_of_week && bestShift.day_of_week.length > 0;
    
    console.log(`   ✅ Selected: ${bestShift.description} (${bestShift.start_time}-${bestShift.end_time})`, 
      isAlternative ? '[ALTERNATIVE]' : '[DEFAULT]');
    
    return {
      date,
      shiftId: bestShift.id,
      shiftType: bestShift.shift_type,
      startTime: bestShift.start_time,
      endTime: bestShift.end_time,
      description: bestShift.description || bestShift.shift_type,
      isWeekend: false,
      isAlternative,
    };
  }

  // No valid shifts for this day, use the first matching shift type anyway
  console.log('   ⚠️ No valid shifts for this day, using fallback');
  const fallbackShift = matchingShifts[0];
  return {
    date,
    shiftId: fallbackShift.id,
    shiftType: fallbackShift.shift_type,
    startTime: fallbackShift.start_time,
    endTime: fallbackShift.end_time,
    description: fallbackShift.description || fallbackShift.shift_type,
    isWeekend: false,
    isAlternative: true,
  };
}

/**
 * Generates previews for all days in a date range
 */
export function generateDayPreviews(
  days: Date[],
  selectedShiftType: string,
  autoDetectWeekends: boolean,
  weekendOverrideShiftId: string | null,
  allShifts: ShiftTimeDefinition[]
): DayShiftPreview[] {
  return days.map(day => 
    getShiftForDate(day, selectedShiftType, autoDetectWeekends, weekendOverrideShiftId, allShifts)
  );
}
