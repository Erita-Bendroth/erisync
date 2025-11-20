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
  const { data, error } = await supabase
    .from('shift_time_definitions')
    .select('*')
    .or(`team_id.eq.${teamId},team_ids.cs.{${teamId}},and(team_id.is.null,team_ids.is.null)`);

  if (error) {
    console.error('Error fetching shift definitions:', error);
    return [];
  }

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

  // If weekend detection is on and it's a weekend, use weekend shift
  if (autoDetectWeekends && isWeekend) {
    const weekendShift = allShifts.find(s => s.shift_type === 'weekend');
    
    if (weekendShift) {
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
    }
  }

  // Find all shifts matching the selected shift type
  const matchingShifts = allShifts.filter(s => s.shift_type === selectedShiftType);

  if (matchingShifts.length === 0) {
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
  const validShiftsForDay = matchingShifts.filter(s => 
    !s.day_of_week || 
    s.day_of_week.length === 0 || 
    s.day_of_week.includes(dayOfWeek)
  );

  if (validShiftsForDay.length > 0) {
    // Use the first valid shift (prefer team-specific, then day-specific)
    const bestShift = validShiftsForDay[0];
    
    // Check if this is an alternative (day-specific) shift
    const isAlternative = bestShift.day_of_week && bestShift.day_of_week.length > 0;
    
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
