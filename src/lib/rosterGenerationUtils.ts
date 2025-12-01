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

    // Fetch all team members from partnership teams
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

    // Create map of users with duty this week
    const usersOnDuty = new Set(
      weekAssignments.filter((a) => a.user_id).map((a) => a.user_id)
    );

    // Generate entries for each team member
    for (const member of teamMembers) {
      const isOnDuty = usersOnDuty.has(member.user_id);
      const shiftType = isOnDuty ? roster.shift_type : roster.default_shift_for_non_duty;

      // Skip if default is "none"
      if (shiftType === "none") continue;

      // Get applicable shift times for this user
      const shiftTimes = await getApplicableShiftTimes(
        shiftType as any
      );

      // Create entries for Monday-Friday (or weekend as applicable)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const entryDate = addDays(currentDate, dayOffset);
        const dayOfWeek = entryDate.getDay();

        // Skip weekends for normal/early/late shifts
        if (
          (shiftType === "normal" || shiftType === "early" || shiftType === "late") &&
          (dayOfWeek === 0 || dayOfWeek === 6)
        ) {
          continue;
        }

        // Only include weekends for weekend shift
        if (shiftType === "weekend" && dayOfWeek !== 0 && dayOfWeek !== 6) {
          continue;
        }

        entries.push({
          user_id: member.user_id,
          team_id: member.team_id,
          date: format(entryDate, "yyyy-MM-dd"),
          shift_type: shiftType,
          activity_type: "work",
          availability_status: "available",
          shift_time_definition_id: shiftTimes.id,
          created_by: createdBy,
          notes: `Auto-generated from roster (Week ${cycleWeekNumber}, ${
            isOnDuty ? "on duty" : "regular schedule"
          })`,
        });
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
