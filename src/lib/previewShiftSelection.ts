import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { matchesCountryCode } from './countryCodeUtils';

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
  country_codes?: string[] | null;
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
    .or(`team_id.eq.${teamId},team_ids.cs.{"${teamId}"},and(team_id.is.null,team_ids.is.null)`);

  if (error) {
    console.error('❌ [PREVIEW DEBUG] Error fetching shift definitions:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('⚠️ [PREVIEW DEBUG] No shifts found for team:', teamId);
    return [];
  }

  console.log(`✅ [PREVIEW DEBUG] Fetched ${data?.length || 0} shift definitions:`, 
    data?.map(s => ({
      id: s.id.substring(0, 8),
      type: s.shift_type,
      times: `${s.start_time}-${s.end_time}`,
      days: s.day_of_week,
      desc: s.description,
      team_id: s.team_id,
      team_ids: s.team_ids,
      country_codes: s.country_codes,
      teamIdsType: typeof s.team_ids
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
  allShifts: ShiftTimeDefinition[],
  userCountryCode?: string
): DayShiftPreview {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  console.log(`🔍 [PREVIEW DEBUG] getShiftForDate called for ${format(date, 'EEE MMM d')} (day ${dayOfWeek}), shiftType="${selectedShiftType}", autoWeekends=${autoDetectWeekends}`);
  
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  console.log(`\n📅 [PREVIEW DEBUG] ${dateStr}`);
  console.log(`   dayOfWeek: ${dayOfWeek}, isWeekend: ${isWeekend}, autoDetectWeekends: ${autoDetectWeekends}`);
  console.log(`   selectedShiftType: "${selectedShiftType}"`);
  console.log(`   Total shifts available: ${allShifts.length}`);

  // If weekend detection is on and it's a weekend, use weekend shift
  if (autoDetectWeekends && isWeekend) {
    console.log('   🔍 Looking for weekend shift...');
    let weekendShifts = allShifts.filter(s => s.shift_type === 'weekend');
    console.log(`   Found ${weekendShifts.length} weekend shifts (before country filter):`, 
      weekendShifts.map(s => ({
        desc: s.description,
        times: `${s.start_time}-${s.end_time}`,
        hasTeamId: !!s.team_id,
        hasTeamIds: !!(s.team_ids && s.team_ids.length > 0),
        country_codes: s.country_codes
      })));
    
    // Filter by country code
    if (userCountryCode) {
      console.log(`   🌍 Filtering weekend shifts by country code: ${userCountryCode}`);
      const countrySpecificWeekendShifts = weekendShifts.filter(
        (shift) => matchesCountryCode(userCountryCode, shift.country_codes)
      );
      const globalWeekendShifts = weekendShifts.filter(
        (shift) => !shift.country_codes || shift.country_codes.length === 0
      );
      
      // Prioritize country-specific weekend shifts, fall back to global
      weekendShifts = countrySpecificWeekendShifts.length > 0 
        ? countrySpecificWeekendShifts 
        : globalWeekendShifts;
      
      console.log(`   Found ${countrySpecificWeekendShifts.length} country-specific weekend shifts and ${globalWeekendShifts.length} global weekend shifts`);
      console.log(`   Using ${weekendShifts.length} weekend shifts after country filtering`);
    }
    
    // Sort weekend shifts: prefer team-specific over global
    const sortedWeekendShifts = [...weekendShifts].sort((a, b) => {
      const aIsTeamSpecific = !!(a.team_id || (a.team_ids && a.team_ids.length > 0));
      const bIsTeamSpecific = !!(b.team_id || (b.team_ids && b.team_ids.length > 0));
      
      // Team-specific shifts come first
      if (aIsTeamSpecific && !bIsTeamSpecific) return -1;
      if (!aIsTeamSpecific && bIsTeamSpecific) return 1;
      return 0;
    });
    
    const weekendShift = sortedWeekendShifts[0];
    
    if (weekendShift) {
      const isTeamSpecific = !!(weekendShift.team_id || (weekendShift.team_ids && weekendShift.team_ids.length > 0));
      console.log(`   ✅ Selected weekend shift: ${weekendShift.description} (${weekendShift.start_time}-${weekendShift.end_time})`,
        isTeamSpecific ? '[TEAM-SPECIFIC]' : '[GLOBAL]',
        userCountryCode ? `[FOR ${userCountryCode}]` : '');
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
  console.log(`   🔍 Looking for shift with ID "${selectedShiftType}"...`);

  // First find the selected shift by ID to get its shift_type enum
  const selectedShiftDef = allShifts.find(s => s.id === selectedShiftType);

  if (!selectedShiftDef) {
    console.log('   ⚠️ Selected shift ID not found, using fallback');
    // Fallback if no shifts match the ID
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

  console.log(`   ✅ Found selected shift: ${selectedShiftDef.description} (type: ${selectedShiftDef.shift_type})`);

  // Now find all shifts with the same shift_type enum
  let matchingShifts = allShifts.filter(s => s.shift_type === selectedShiftDef.shift_type);
  console.log(`   Found ${matchingShifts.length} shifts with shift_type="${selectedShiftDef.shift_type}"`);

  // Filter by country if user country code is provided
  if (userCountryCode) {
    console.log(`   🌍 Filtering by country code: ${userCountryCode}`);
    const countrySpecificShifts = matchingShifts.filter(
      (shift) => matchesCountryCode(userCountryCode, shift.country_codes)
    );
    const globalShifts = matchingShifts.filter(
      (shift) => !shift.country_codes || shift.country_codes.length === 0
    );
    
    // Prioritize country-specific shifts, fall back to global shifts
    matchingShifts = countrySpecificShifts.length > 0 ? countrySpecificShifts : globalShifts;
    console.log(`   Found ${countrySpecificShifts.length} country-specific shifts and ${globalShifts.length} global shifts`);
    console.log(`   Using ${matchingShifts.length} shifts after country filtering`);
  }

  console.log(`   Found ${matchingShifts.length} shifts:`, 
    matchingShifts.map(s => ({
      desc: s.description,
      times: `${s.start_time}-${s.end_time}`,
      days: s.day_of_week
    })));

  // Filter shifts that are valid for this day of week
  console.log(`   🔍 Filtering by day_of_week (${dayOfWeek})...`);
  const validShiftsForDay = matchingShifts.filter(s => 
    !s.day_of_week || 
    s.day_of_week.length === 0 || 
    s.day_of_week.includes(dayOfWeek)
  );
  console.log(`   Found ${validShiftsForDay.length} valid shifts for this day`);

  // If no valid shifts found, use the selected shift as fallback
  if (validShiftsForDay.length === 0) {
    console.log(`   ⚠️ No valid shifts for day ${dayOfWeek}, using selected shift as fallback`);
    return {
      date,
      shiftId: selectedShiftDef.id,
      shiftType: selectedShiftDef.shift_type,
      startTime: selectedShiftDef.start_time,
      endTime: selectedShiftDef.end_time,
      description: selectedShiftDef.description || 'Fallback shift',
      isWeekend: false,
      isAlternative: false,
    };
  }


  if (validShiftsForDay.length > 0) {
    console.log(`   📋 Before sorting, ${validShiftsForDay.length} candidate shifts:`,
      validShiftsForDay.map(s => ({
        id: s.id.substring(0, 8),
        desc: s.description,
        days: s.day_of_week,
        dayCount: s.day_of_week?.length || 0,
        times: `${s.start_time}-${s.end_time}`,
        hasTeamId: !!s.team_id,
        hasTeamIds: !!(s.team_ids && s.team_ids.length > 0),
        teamIdsCount: s.team_ids?.length || 0
      })));
    
    // Sort to prefer team-specific shifts, then day-specific shifts, then more specific days
    const sortedShifts = [...validShiftsForDay].sort((a, b) => {
      const aIsTeamSpecific = !!(a.team_id || (a.team_ids && a.team_ids.length > 0));
      const bIsTeamSpecific = !!(b.team_id || (b.team_ids && b.team_ids.length > 0));
      
      // Team-specific shifts come first
      if (aIsTeamSpecific && !bIsTeamSpecific) return -1;
      if (!aIsTeamSpecific && bIsTeamSpecific) return 1;
      
      // Then prefer day-specific shifts
      const aHasDays = a.day_of_week && a.day_of_week.length > 0;
      const bHasDays = b.day_of_week && b.day_of_week.length > 0;
      if (aHasDays && !bHasDays) return -1;
      if (!aHasDays && bHasDays) return 1;
      
      // If both have days, prefer the one with FEWER days (more specific)
      if (aHasDays && bHasDays) {
        const lengthDiff = a.day_of_week!.length - b.day_of_week!.length;
        console.log(`      🔢 Comparing day counts: "${a.description}" (${a.day_of_week!.length} days) vs "${b.description}" (${b.day_of_week!.length} days) = ${lengthDiff}`);
        if (lengthDiff !== 0) return lengthDiff; // Negative means a < b (a comes first)
      }
      
      return 0;
    });
    
    console.log(`   🏆 After sorting, winner is first:`,
      sortedShifts.map((s, i) => ({
        rank: i + 1,
        id: s.id.substring(0, 8),
        desc: s.description,
        days: s.day_of_week,
        dayCount: s.day_of_week?.length || 0
      })));
    
    const bestShift = sortedShifts[0];
    
    // Check if this is an alternative (day-specific) shift
    const isAlternative = bestShift.day_of_week && bestShift.day_of_week.length > 0;
    const isTeamSpecific = !!(bestShift.team_id || (bestShift.team_ids && bestShift.team_ids.length > 0));
    
    console.log(`   ✅ Selected: ${bestShift.description} (${bestShift.start_time}-${bestShift.end_time})`, 
      isAlternative ? '[ALTERNATIVE]' : '[DEFAULT]',
      isTeamSpecific ? '[TEAM-SPECIFIC]' : '[GLOBAL]');
    
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
  allShifts: ShiftTimeDefinition[],
  userCountryCode?: string
): DayShiftPreview[] {
  return days.map(day => 
    getShiftForDate(day, selectedShiftType, autoDetectWeekends, weekendOverrideShiftId, allShifts, userCountryCode)
  );
}
