import { supabase } from "@/integrations/supabase/client";

export interface ShiftTimeDefinition {
  id: string;
  team_id: string | null;
  region_code: string | null;
  shift_type: "normal" | "early" | "late";
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
 * 1. Team + region + day (highest priority)
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
  shiftType: "normal" | "early" | "late";
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

  // Priority 1: Team + region + day
  const teamRegionDay = data.find(
    (def) =>
      def.team_id === teamId &&
      def.region_code === regionCode &&
      def.day_of_week !== null &&
      dayOfWeek !== undefined &&
      def.day_of_week.includes(dayOfWeek)
  );
  if (teamRegionDay) {
    return {
      startTime: teamRegionDay.start_time,
      endTime: teamRegionDay.end_time,
      description: teamRegionDay.description || "",
    };
  }

  // Priority 2: Team + region
  const teamRegion = data.find(
    (def) =>
      def.team_id === teamId &&
      def.region_code === regionCode &&
      def.day_of_week === null
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
      def.team_id === teamId &&
      def.region_code === null &&
      def.day_of_week === null
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
      def.day_of_week === null
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
      def.day_of_week === null
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
  shiftType: "normal" | "early" | "late"
): ApplicableShiftTime {
  const defaults = {
    normal: { startTime: "08:00", endTime: "16:30", description: "Normal shift" },
    early: { startTime: "06:00", endTime: "14:00", description: "Early shift" },
    late: { startTime: "14:00", endTime: "22:00", description: "Late shift" },
  };
  return defaults[shiftType];
}

export function getShiftTypeColor(
  shiftType: string,
  activityType?: string
): string {
  if (activityType === "vacation") return "hsl(var(--chart-5))"; // Purple
  if (activityType === "sick") return "hsl(var(--muted))"; // Gray

  switch (shiftType) {
    case "early":
      return "hsl(var(--destructive))"; // Red
    case "late":
      return "hsl(var(--chart-1))"; // Blue
    case "weekend":
      return "hsl(var(--chart-3))"; // Orange/Brown
    default:
      return "hsl(var(--chart-2))"; // Green/Default
  }
}

export function getShiftTypeCode(
  shiftType: string,
  activityType?: string
): string {
  if (activityType === "vacation") return "U";
  if (activityType === "sick") return "K";

  switch (shiftType) {
    case "early":
      return "F";
    case "late":
      return "S";
    case "weekend":
      return "W";
    default:
      return "N";
  }
}
