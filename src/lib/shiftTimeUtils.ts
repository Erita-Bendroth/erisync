import { supabase } from "@/integrations/supabase/client";

export interface ShiftTimeDefinition {
  id: string;
  team_id: string | null;
  team_ids: string[] | null;
  region_code: string | null;
  shift_type: "normal" | "early" | "late" | "weekend";
  day_of_week: number[] | null;
  start_time: string;
  end_time: string;
  description: string | null;
}

export interface ApplicableShiftTime {
  startTime: string;
  endTime: string;
  description: string;
}

/**
 * Get applicable shift times with priority resolution:
 * 1. Team + region + day(s) (highest priority)
 * 2. Team + region
 * 3. Team only
 * 4. Region only
 * 5. Global default (lowest priority)
 */
export async function getApplicableShiftTimes({
  teamId,
  regionCode,
  shiftType,
  dayOfWeek,
}: {
  teamId?: string;
  regionCode?: string;
  shiftType: "normal" | "early" | "late" | "weekend";
  dayOfWeek?: number;
}): Promise<ApplicableShiftTime> {
  const { data, error } = await supabase
    .from("shift_time_definitions")
    .select("*")
    .eq("shift_type", shiftType)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching shift times:", error);
    return getDefaultShiftTime(shiftType);
  }

  if (!data || data.length === 0) {
    return getDefaultShiftTime(shiftType);
  }

  // Priority 1: Team + region + day(s)
  if (dayOfWeek !== undefined) {
    const teamRegionDay = data.find(
      (def) =>
        ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId) &&
        def.region_code === regionCode &&
        def.day_of_week !== null &&
        Array.isArray(def.day_of_week) &&
        def.day_of_week.includes(dayOfWeek)
    );
    if (teamRegionDay) {
      return {
        startTime: teamRegionDay.start_time,
        endTime: teamRegionDay.end_time,
        description: teamRegionDay.description || "",
      };
    }
  }

  // Priority 2: Team + region (no specific days)
  const teamRegion = data.find(
    (def) =>
      ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId) &&
      def.region_code === regionCode &&
      (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0))
  );
  if (teamRegion) {
    return {
      startTime: teamRegion.start_time,
      endTime: teamRegion.end_time,
      description: teamRegion.description || "",
    };
  }

  // Priority 3: Team only
  const teamOnly = data.find(
    (def) =>
      ((def.team_ids && def.team_ids.includes(teamId)) || def.team_id === teamId) &&
      def.region_code === null &&
      (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0))
  );
  if (teamOnly) {
    return {
      startTime: teamOnly.start_time,
      endTime: teamOnly.end_time,
      description: teamOnly.description || "",
    };
  }

  // Priority 4: Region only
  const regionOnly = data.find(
    (def) =>
      def.team_id === null &&
      def.region_code === regionCode &&
      (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0))
  );
  if (regionOnly) {
    return {
      startTime: regionOnly.start_time,
      endTime: regionOnly.end_time,
      description: regionOnly.description || "",
    };
  }

  // Priority 5: Global default
  const globalDefault = data.find(
    (def) =>
      def.team_id === null &&
      def.region_code === null &&
      (def.day_of_week === null || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0))
  );
  if (globalDefault) {
    return {
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
    normal: { startTime: "08:00", endTime: "16:30", description: "Normal shift" },
    early: { startTime: "06:00", endTime: "14:00", description: "Early shift" },
    late: { startTime: "14:00", endTime: "22:00", description: "Late shift" },
    weekend: { startTime: "08:00", endTime: "16:00", description: "Weekend / National Holiday shift" },
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
