import { supabase } from "@/integrations/supabase/client";
import { addWeeks, startOfWeek, addDays, format } from "date-fns";
import { getApplicableShiftTimes } from "./shiftTimeUtils";

interface RosterConfig {
  id: string;
  shift_type: string;
  cycle_length_weeks: number;
  start_date: string;
  end_date: string | null;
  default_shift_for_non_duty: string;
  partnership_id: string;
}

interface WeekAssignment {
  week_number: number;
  user_id: string | null;
  team_id: string;
  shift_type: string | null;
}

interface TeamMember {
  user_id: string;
  team_id: string;
  country_code: string | null;
  region_code: string | null;
}

export async function generateRosterSchedules(
  rosterId: string,
  userId: string
): Promise<{ success: boolean; entriesCreated: number; error?: string }> {
  try {
    // Fetch roster configuration
    const { data: roster, error: rosterError } = await supabase
      .from("partnership_rotation_rosters")
      .select("*")
      .eq("id", rosterId)
      .single();

    if (rosterError) throw rosterError;

    // Fetch all week assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("roster_week_assignments")
      .select("*")
      .eq("roster_id", rosterId);

    if (assignmentsError) throw assignmentsError;

    // Fetch all team members from partnership teams with location data
    const { data: partnership, error: partnershipError } = await supabase
      .from("team_planning_partners")
      .select("team_ids")
      .eq("id", roster.partnership_id)
      .single();

    if (partnershipError) throw partnershipError;

    const { data: teamMembers, error: membersError } = await supabase
      .from("team_members")
      .select(`
        user_id,
        team_id,
        profiles!inner (
          country_code,
          region_code
        )
      `)
      .in("team_id", partnership.team_ids);

    if (membersError) throw membersError;

    const membersList: TeamMember[] = teamMembers.map((tm: any) => ({
      user_id: tm.user_id,
      team_id: tm.team_id,
      country_code: tm.profiles.country_code,
      region_code: tm.profiles.region_code,
    }));

    // Generate schedule entries
    const scheduleEntries = await generateScheduleEntries(
      roster,
      assignments,
      membersList,
      userId
    );

    // Insert schedule entries in batches
    const batchSize = 100;
    let entriesCreated = 0;

    for (let i = 0; i < scheduleEntries.length; i += batchSize) {
      const batch = scheduleEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("schedule_entries")
        .insert(batch);

      if (insertError) {
        console.error("Error inserting batch:", insertError);
        throw insertError;
      }

      entriesCreated += batch.length;
    }

    // Update roster status to implemented
    const { error: updateError } = await supabase
      .from("partnership_rotation_rosters")
      .update({ status: "implemented" })
      .eq("id", rosterId);

    if (updateError) throw updateError;

    return { success: true, entriesCreated };
  } catch (error) {
    console.error("Error generating roster schedules:", error);
    return {
      success: false,
      entriesCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function generateScheduleEntries(
  roster: RosterConfig,
  assignments: WeekAssignment[],
  teamMembers: TeamMember[],
  createdBy: string
) {
  const entries: any[] = [];
  const startDate = new Date(roster.start_date);
  const endDate = roster.end_date
    ? new Date(roster.end_date)
    : addWeeks(startDate, 52); // Default to 1 year

  let currentDate = startOfWeek(startDate, { weekStartsOn: 1 });
  let weekCounter = 0;

  while (currentDate <= endDate) {
    const cycleWeekNumber = (weekCounter % roster.cycle_length_weeks) + 1;

    // Get assignments for this week
    const weekAssignments = assignments.filter(
      (a) => a.week_number === cycleWeekNumber
    );

    // Generate entries for each team member
    for (const member of teamMembers) {
      // Find if this member has an assignment this week
      const assignment = weekAssignments.find(
        (a) => a.user_id === member.user_id
      );

      if (!assignment || !assignment.shift_type || assignment.shift_type === "off") {
        continue; // Skip if no assignment or off
      }

      const shiftType = assignment.shift_type;

      // Check if this is a compound shift (weekend + weekday)
      const isCompoundShift = shiftType.startsWith("weekend_");
      
      if (isCompoundShift) {
        // Handle compound shifts: weekend + weekday combination
        const weekdayShift = shiftType.replace("weekend_", "") as "normal" | "early" | "late";

        // Generate weekend entries (Sat/Sun)
        for (let dayOffset = 5; dayOffset <= 6; dayOffset++) {
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate > endDate) continue;

          const shiftTimes = await getApplicableShiftTimes({
            teamId: member.team_id,
            countryCode: member.country_code || undefined,
            regionCode: member.region_code || undefined,
            shiftType: "weekend",
            dayOfWeek: entryDate.getDay(),
            date: format(entryDate, "yyyy-MM-dd"),
          });

          entries.push({
            user_id: member.user_id,
            team_id: member.team_id,
            date: format(entryDate, "yyyy-MM-dd"),
            shift_type: "weekend",
            activity_type: "work",
            availability_status: "available",
            shift_time_definition_id: shiftTimes.id !== "default-weekend" ? shiftTimes.id : null,
            created_by: createdBy,
            notes: `${shiftTimes.startTime}-${shiftTimes.endTime}`,
          });
        }

        // Generate weekday entries (Mon-Fri)
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate > endDate) continue;

          const shiftTimes = await getApplicableShiftTimes({
            teamId: member.team_id,
            countryCode: member.country_code || undefined,
            regionCode: member.region_code || undefined,
            shiftType: weekdayShift,
            dayOfWeek: entryDate.getDay(),
            date: format(entryDate, "yyyy-MM-dd"),
          });

          entries.push({
            user_id: member.user_id,
            team_id: member.team_id,
            date: format(entryDate, "yyyy-MM-dd"),
            shift_type: weekdayShift,
            activity_type: "work",
            availability_status: "available",
            shift_time_definition_id: shiftTimes.id.startsWith("default-") ? null : shiftTimes.id,
            created_by: createdBy,
            notes: `${shiftTimes.startTime}-${shiftTimes.endTime}`,
          });
        }
      } else {
        // Handle simple shifts (late, early, normal, weekend only)
        const simpleShiftType = shiftType as "normal" | "early" | "late" | "weekend";

        // Determine which days to include
        const isWeekendOnly = simpleShiftType === "weekend";
        const dayRange = isWeekendOnly ? [5, 6] : [0, 1, 2, 3, 4]; // Weekend: Sat/Sun, Others: Mon-Fri

        for (const dayOffset of dayRange) {
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate > endDate) continue;

          const shiftTimes = await getApplicableShiftTimes({
            teamId: member.team_id,
            countryCode: member.country_code || undefined,
            regionCode: member.region_code || undefined,
            shiftType: simpleShiftType,
            dayOfWeek: entryDate.getDay(),
            date: format(entryDate, "yyyy-MM-dd"),
          });

          entries.push({
            user_id: member.user_id,
            team_id: member.team_id,
            date: format(entryDate, "yyyy-MM-dd"),
            shift_type: simpleShiftType,
            activity_type: "work",
            availability_status: "available",
            shift_time_definition_id: shiftTimes.id.startsWith("default-") ? null : shiftTimes.id,
            created_by: createdBy,
            notes: `${shiftTimes.startTime}-${shiftTimes.endTime}`,
          });
        }
      }
    }

    currentDate = addWeeks(currentDate, 1);
    weekCounter++;
  }

  return entries;
}

export async function validateRosterApprovals(
  rosterId: string
): Promise<{ allApproved: boolean; pendingManagers: string[] }> {
  try {
    const { data: approvals, error } = await supabase
      .from("roster_manager_approvals")
      .select(`
        approved,
        profiles!roster_manager_approvals_manager_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq("roster_id", rosterId);

    if (error) throw error;

    const pendingManagers = approvals
      .filter((a: any) => !a.approved)
      .map((a: any) => `${a.profiles.first_name} ${a.profiles.last_name}`);

    return {
      allApproved: pendingManagers.length === 0,
      pendingManagers,
    };
  } catch (error) {
    console.error("Error validating approvals:", error);
    return { allApproved: false, pendingManagers: [] };
  }
}
