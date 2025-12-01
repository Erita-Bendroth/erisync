import { supabase } from "@/integrations/supabase/client";
import { matchesCountryCode } from './countryCodeUtils';

export interface ShiftTimeDefinition {
  id: string;
  team_id: string | null;
  team_ids: string[] | null;
  region_code: string | null;
  country_codes?: string[] | null;
  shift_type: "normal" | "early" | "late" | "weekend";
  day_of_week: number[] | null;
  start_time: string;
  end_time: string;
  description: string | null;
}

export interface ApplicableShiftTime {
  id: string;  // The shift_time_definition_id that was matched
  startTime: string;
  endTime: string;
  description: string;
}

/**
 * Get applicable shift times with priority resolution:
 * 1. Specific shift_time_definition_id if provided (highest priority)
 * 2. Team + region + day(s)
 * 3. Team + region
 * 4. Team only
 * 5. Region only
 * 6. Global default (lowest priority)
 * 
 * For "weekend" shift type, automatically applies to Saturdays, Sundays, and public holidays.
 */
export async function getApplicableShiftTimes({
  teamId,
  regionCode,
  countryCode,
  shiftType,
  dayOfWeek,
  date,
  shiftTimeDefinitionId,
}: {
  teamId?: string;
  regionCode?: string;
  countryCode?: string;
  shiftType: "normal" | "early" | "late" | "weekend";
  dayOfWeek?: number;
  date?: string;
  shiftTimeDefinitionId?: string;
}): Promise<ApplicableShiftTime> {
  // Priority 0: If specific shift definition ID provided, get its shift_type as base
  // but still find best match for the specific day
  let baseShiftType = shiftType;
  if (shiftTimeDefinitionId) {
    const { data: specificShift, error } = await supabase
      .from("shift_time_definitions")
      .select("shift_type")
      .eq("id", shiftTimeDefinitionId)
      .single();
    
    if (specificShift && !error) {
      baseShiftType = specificShift.shift_type;
    }
  }

  // For weekend shift type, check if date is a public holiday
  let isPublicHoliday = false;
  if (shiftType === 'weekend' && date) {
    const { data: holidayData } = await supabase
      .from('holidays')
      .select('id')
      .eq('date', date)
      .eq('is_public', true)
      .is('user_id', null)
      .limit(1);
    
    isPublicHoliday = !!holidayData && holidayData.length > 0;
  }

  const { data, error } = await supabase
    .from("shift_time_definitions")
    .select("*")
    .eq("shift_type", baseShiftType)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching shift times:", error);
    return getDefaultShiftTime(shiftType);
  }

  if (!data || data.length === 0) {
    return getDefaultShiftTime(shiftType);
  }

  // For weekend shift type, automatically match if it's Sat/Sun or a public holiday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const shouldApplyWeekendShift = baseShiftType === 'weekend' && (isWeekend || isPublicHoliday);

  // Priority 1: Team + Country + specific day (most specific)
  if (teamId && dayOfWeek !== undefined) {
    const teamCountryDay = data.find(
      (def) => {
        const matchesTeam = ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId);
        const matchesCountry = matchesCountryCode(countryCode, def.country_codes);
        const matchesDay = baseShiftType === 'weekend' 
          ? shouldApplyWeekendShift
          : (def.day_of_week !== null && Array.isArray(def.day_of_week) && def.day_of_week.includes(dayOfWeek));
        
        return matchesTeam && matchesCountry && matchesDay;
      }
    );
    if (teamCountryDay) {
      return {
        id: teamCountryDay.id,
        startTime: teamCountryDay.start_time,
        endTime: teamCountryDay.end_time,
        description: teamCountryDay.description || "",
      };
    }
  }

  // Priority 2: Team + Country (no day restriction)
  if (teamId && countryCode) {
    const teamCountry = data.find(
      (def) => {
        const matchesTeam = ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId);
        const matchesCountry = matchesCountryCode(countryCode, def.country_codes);
        const noDay = (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0));
        
        // For weekend shift type, still apply if it's weekend/holiday
        if (baseShiftType === 'weekend' && !shouldApplyWeekendShift) {
          return false;
        }
        
        return matchesTeam && matchesCountry && noDay;
      }
    );
    if (teamCountry) {
      return {
        id: teamCountry.id,
        startTime: teamCountry.start_time,
        endTime: teamCountry.end_time,
        description: teamCountry.description || "",
      };
    }
  }

  // Priority 3: Team only + specific day (no country requirement)
  if (teamId && dayOfWeek !== undefined) {
    const teamDayOnly = data.find(
      (def) => {
        const matchesTeam = ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId);
        const matchesDay = baseShiftType === 'weekend' 
          ? shouldApplyWeekendShift
          : (def.day_of_week !== null && Array.isArray(def.day_of_week) && def.day_of_week.includes(dayOfWeek));
        
        return matchesTeam && matchesDay;
      }
    );
    if (teamDayOnly) {
      return {
        id: teamDayOnly.id,
        startTime: teamDayOnly.start_time,
        endTime: teamDayOnly.end_time,
        description: teamDayOnly.description || "",
      };
    }
  }

  // Priority 4: Team only (no country or day restriction)
  if (teamId) {
    const teamOnlyNoDay = data.find(
      (def) => {
        const matchesTeam = ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId);
        const noDay = (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0));
        
        // For weekend shift type, still apply if it's weekend/holiday
        if (baseShiftType === 'weekend' && !shouldApplyWeekendShift) {
          return false;
        }
        
        return matchesTeam && noDay;
      }
    );
    if (teamOnlyNoDay) {
      return {
        id: teamOnlyNoDay.id,
        startTime: teamOnlyNoDay.start_time,
        endTime: teamOnlyNoDay.end_time,
        description: teamOnlyNoDay.description || "",
      };
    }
  }

  // Priority 5: Country only + specific day
  if (countryCode && dayOfWeek !== undefined) {
    const countryDayOnly = data.find(
      (def) => {
        const matchesCountry = matchesCountryCode(countryCode, def.country_codes);
        const noTeam = (def.team_id === null || def.team_ids === null || (Array.isArray(def.team_ids) && def.team_ids.length === 0));
        const matchesDay = baseShiftType === 'weekend' 
          ? shouldApplyWeekendShift
          : (def.day_of_week !== null && Array.isArray(def.day_of_week) && def.day_of_week.includes(dayOfWeek));
        
        return matchesCountry && noTeam && matchesDay;
      }
    );
    if (countryDayOnly) {
      return {
        id: countryDayOnly.id,
        startTime: countryDayOnly.start_time,
        endTime: countryDayOnly.end_time,
        description: countryDayOnly.description || "",
      };
    }
  }

  // Priority 6: Country only (no day restriction)
  if (countryCode) {
    const countryOnly = data.find(
      (def) => {
        const matchesCountry = matchesCountryCode(countryCode, def.country_codes);
        const noTeam = (def.team_id === null || def.team_ids === null || (Array.isArray(def.team_ids) && def.team_ids.length === 0));
        const noDay = (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0));
        
        // For weekend shift type, still apply if it's weekend/holiday
        if (baseShiftType === 'weekend' && !shouldApplyWeekendShift) {
          return false;
        }
        
        return matchesCountry && noTeam && noDay;
      }
    );
    if (countryOnly) {
      return {
        id: countryOnly.id,
        startTime: countryOnly.start_time,
        endTime: countryOnly.end_time,
        description: countryOnly.description || "",
      };
    }
  }

  // Priority 7: Global default (no team, no country, no day)
  const globalDefault = data.find(
    (def) => {
      const noTeam = def.team_id === null && (def.team_ids === null || (Array.isArray(def.team_ids) && def.team_ids.length === 0));
      const noCountry = def.country_codes === null || (Array.isArray(def.country_codes) && def.country_codes.length === 0);
      const noDay = (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0));
      
      // For weekend shift type, still apply if it's weekend/holiday
      if (baseShiftType === 'weekend' && !shouldApplyWeekendShift) {
        return false;
      }
      
      return noTeam && noCountry && noDay;
    }
  );
  if (globalDefault) {
    return {
      id: globalDefault.id,
      startTime: globalDefault.start_time,
      endTime: globalDefault.end_time,
      description: globalDefault.description || "",
    };
  }

  return getDefaultShiftTime(shiftType);
}

function getDefaultShiftTime(
  shiftType: "normal" | "early" | "late" | "weekend"
): ApplicableShiftTime {
  const defaults = {
    normal: { id: "default-normal", startTime: "08:00", endTime: "16:30", description: "Normal shift" },
    early: { id: "default-early", startTime: "06:00", endTime: "14:00", description: "Early shift" },
    late: { id: "default-late", startTime: "14:00", endTime: "22:00", description: "Late shift" },
    weekend: { id: "default-weekend", startTime: "08:00", endTime: "16:00", description: "Weekend / National Holiday shift" },
  };
  return defaults[shiftType];
}

export function getShiftTypeColor(
  shiftType: string,
  activityType?: string
): string {
  // Activity types override shift types for color
  if (activityType === "vacation") {
    return "hsl(280, 70%, 50%)"; // Purple for vacation
  }
  if (activityType === "sick" || activityType === "off") {
    return "hsl(220, 13%, 46%)"; // Gray for sick/off days
  }
  if (activityType === "training") {
    return "hsl(220, 13%, 46%)"; // Gray for training
  }

  // Shift type colors - Norwegian conventions
  switch (shiftType) {
    case "early":
      return "hsl(142, 76%, 36%)"; // Green for early shifts (weekdays)
    case "late":
      return "hsl(25, 95%, 53%)"; // Orange for late shifts (weekdays)
    case "weekend":
      return "hsl(173, 58%, 39%)"; // Teal for weekend/holiday duty
    case "normal":
      return "hsl(48, 96%, 53%)"; // Light yellow for normal shifts
    default:
      return "hsl(220, 13%, 46%)"; // Default gray
  }
}

export function getShiftTypeCode(
  shiftType: string,
  activityType?: string
): string {
  // Activity types take precedence
  if (activityType === "vacation") return "U"; // Urlaub/Vacation
  if (activityType === "sick") return "S"; // Sykdom/Sick
  if (activityType === "training") return "K"; // Kurs/Training
  if (activityType === "off") return "F"; // Fridag/Off

  // Shift types
  switch (shiftType) {
    case "early":
      return "E"; // Early shift
    case "late":
      return "L"; // Late shift
    case "weekend":
      return "W"; // Weekend duty
    case "normal":
      return "N"; // Normal shift
    default:
      return "-";
  }
}
