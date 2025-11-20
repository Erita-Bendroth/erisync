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
  selectedShiftId: string,
  autoDetectWeekends: boolean,
  weekendOverrideShiftId: string | null,
  allShifts: ShiftTimeDefinition[]
): DayShiftPreview {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // If weekend detection is on and it's a weekend, use weekend shift
  if (autoDetectWeekends && isWeekend) {
    const weekendShiftId = weekendOverrideShiftId || selectedShiftId;
    const weekendShift = allShifts.find(s => s.id === weekendShiftId && s.shift_type === 'weekend');
    
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

  // Try to find the selected shift first
  const selectedShift = allShifts.find(s => s.id === selectedShiftId);

  if (selectedShift) {
    // Check if this shift has day_of_week constraints
    if (selectedShift.day_of_week && selectedShift.day_of_week.length > 0) {
      // If the shift is valid for this day, use it
      if (selectedShift.day_of_week.includes(dayOfWeek)) {
        return {
          date,
          shiftId: selectedShift.id,
          shiftType: selectedShift.shift_type,
          startTime: selectedShift.start_time,
          endTime: selectedShift.end_time,
          description: selectedShift.description || selectedShift.shift_type,
          isWeekend: false,
          isAlternative: false,
        };
      }

      // If not valid for this day, find an alternative shift with same shift_type
      const alternativeShift = allShifts.find(s => 
        s.shift_type === selectedShift.shift_type &&
        s.id !== selectedShift.id &&
        (!s.day_of_week || s.day_of_week.length === 0 || s.day_of_week.includes(dayOfWeek))
      );

      if (alternativeShift) {
        return {
          date,
          shiftId: alternativeShift.id,
          shiftType: alternativeShift.shift_type,
          startTime: alternativeShift.start_time,
          endTime: alternativeShift.end_time,
          description: alternativeShift.description || alternativeShift.shift_type,
          isWeekend: false,
          isAlternative: true,
        };
      }
    } else {
      // No day constraints, use selected shift
      return {
        date,
        shiftId: selectedShift.id,
        shiftType: selectedShift.shift_type,
        startTime: selectedShift.start_time,
        endTime: selectedShift.end_time,
        description: selectedShift.description || selectedShift.shift_type,
        isWeekend: false,
        isAlternative: false,
      };
    }
  }

  // Fallback: use first available shift
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

/**
 * Generates previews for all days in a date range
 */
export function generateDayPreviews(
  days: Date[],
  selectedShiftId: string,
  autoDetectWeekends: boolean,
  weekendOverrideShiftId: string | null,
  allShifts: ShiftTimeDefinition[]
): DayShiftPreview[] {
  return days.map(day => 
    getShiftForDate(day, selectedShiftId, autoDetectWeekends, weekendOverrideShiftId, allShifts)
  );
}
