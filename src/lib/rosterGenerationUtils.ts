import { supabase } from "@/integrations/supabase/client";
import { addWeeks, startOfWeek, addDays, format } from "date-fns";
import { getApplicableShiftTimes } from "./shiftTimeUtils";
import { normalizeCountryCode } from "./countryCodeUtils";

type ShiftTypeName = "normal" | "early" | "late" | "weekend";

/**
 * Returns Set<dateStr> for dates that are public holidays for the given country.
 */
async function fetchHolidayDateSet(
  countryCode: string | null | undefined,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) return new Set();
  const { data } = await supabase
    .from("holidays")
    .select("date, country_code")
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("is_public", true)
    .is("user_id", null);
  const set = new Set<string>();
  (data ?? []).forEach((h: any) => {
    if (normalizeCountryCode(h.country_code) === normalized) set.add(h.date);
  });
  return set;
}

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
  day_of_week: number | null;
  include_weekends: boolean;
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
): Promise<{ success: boolean; entriesCreated: number; entriesDeleted?: number; warnings?: string[]; error?: string }> {
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
        profiles!team_members_user_id_fkey (
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

    // Calculate date range for cleanup
    const startDate = new Date(roster.start_date);
    const endDate = roster.end_date
      ? new Date(roster.end_date)
      : addWeeks(startDate, 52);
    
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");
    
    // Get unique user IDs and team IDs
    const userIds = [...new Set(membersList.map(m => m.user_id))];
    const teamIds = partnership.team_ids;

    // Delete existing work entries for partnership members within date range
    console.log(`🧹 Cleaning up existing work entries from ${startDateStr} to ${endDateStr} for ${userIds.length} users...`);
    
    const { error: deleteError, count: deletedCount } = await supabase
      .from("schedule_entries")
      .delete({ count: 'exact' })
      .in("user_id", userIds)
      .in("team_id", teamIds)
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .eq("activity_type", "work");

    if (deleteError) {
      console.error("Error deleting existing entries:", deleteError);
      throw deleteError;
    }

    console.log(`🧹 Deleted ${deletedCount || 0} existing work entries`);

    // Generate schedule entries
    const { entries: scheduleEntries, warnings } = await generateScheduleEntries(
      roster,
      assignments,
      membersList,
      userId
    );

    // De-duplicate entries before insertion (same user+date+team should only have one entry)
    const uniqueEntriesMap = new Map<string, typeof scheduleEntries[0]>();
    for (const entry of scheduleEntries) {
      const key = `${entry.user_id}_${entry.date}_${entry.team_id}`;
      uniqueEntriesMap.set(key, entry); // Later entries override earlier ones
    }
    const deduplicatedEntries = Array.from(uniqueEntriesMap.values());

    console.log(`Generated ${scheduleEntries.length} entries, deduplicated to ${deduplicatedEntries.length}`);

    // Insert schedule entries in batches using upsert to handle existing entries
    const batchSize = 100;
    let entriesCreated = 0;

    for (let i = 0; i < deduplicatedEntries.length; i += batchSize) {
      const batch = deduplicatedEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("schedule_entries")
        .upsert(batch, { 
          onConflict: 'user_id,date,team_id',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error("Error inserting batch:", insertError);
        throw insertError;
      }

      entriesCreated += batch.length;
    }

    // Activation is gated server-side via activate_roster RPC (checks all approvals + version)
    const { error: activateError } = await supabase.rpc("activate_roster", {
      _roster_id: rosterId,
    });

    if (activateError) throw activateError;

    return { success: true, entriesCreated, entriesDeleted: deletedCount || 0, warnings };
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
): Promise<{ entries: any[]; warnings: string[] }> {
  const entries: any[] = [];
  const warnings: string[] = [];
  const startDate = new Date(roster.start_date);
  const endDate = roster.end_date
    ? new Date(roster.end_date)
    : addWeeks(startDate, 52); // Default to 1 year

  // Pre-fetch holidays per unique country for the full date range
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");
  const uniqueCountries = Array.from(
    new Set(teamMembers.map((m) => normalizeCountryCode(m.country_code)).filter(Boolean) as string[])
  );
  const holidaysByCountry = new Map<string, Set<string>>();
  for (const c of uniqueCountries) {
    holidaysByCountry.set(c, await fetchHolidayDateSet(c, startStr, endStr));
  }

  const isHolidayForMember = (member: TeamMember, dateStr: string) => {
    const c = normalizeCountryCode(member.country_code);
    if (!c) return false;
    return holidaysByCountry.get(c)?.has(dateStr) ?? false;
  };

  const defaultNonDuty = (roster.default_shift_for_non_duty || "normal") as ShiftTypeName;

  // Build & validate a single entry, applying weekend/holiday guard.
  const buildEntry = async (
    member: TeamMember,
    entryDate: Date,
    requestedShiftType: ShiftTypeName
  ) => {
    const dateStr = format(entryDate, "yyyy-MM-dd");
    const dow = entryDate.getDay();
    const isWeekendDay = dow === 0 || dow === 6;
    const isHoliday = isHolidayForMember(member, dateStr);

    let effectiveShiftType: ShiftTypeName = requestedShiftType;

    // Weekend-shift validation: weekend can only land on Sat/Sun OR a public holiday for the member.
    if (effectiveShiftType === "weekend" && !isWeekendDay && !isHoliday) {
      warnings.push(
        `Downgraded invalid weekend shift on ${dateStr} for user ${member.user_id} (${member.country_code ?? "??"}) → ${defaultNonDuty}`
      );
      effectiveShiftType = defaultNonDuty;
    }

    // On a public holiday for the member's country, flip weekday shifts to "weekend"
    // so the correct holiday/weekend times apply.
    if (effectiveShiftType !== "weekend" && isHoliday) {
      effectiveShiftType = "weekend";
    }

    const shiftTimes = await getApplicableShiftTimes({
      teamId: member.team_id,
      countryCode: member.country_code || undefined,
      regionCode: member.region_code || undefined,
      shiftType: effectiveShiftType,
      dayOfWeek: dow,
      date: dateStr,
    });

    if (shiftTimes.id.startsWith("default-")) {
      warnings.push(
        `No shift definition for ${effectiveShiftType} / ${member.country_code ?? "??"} on ${dateStr} — using built-in default`
      );
    }

    entries.push({
      user_id: member.user_id,
      team_id: member.team_id,
      date: dateStr,
      shift_type: effectiveShiftType,
      activity_type: "work",
      availability_status: "available",
      shift_time_definition_id: shiftTimes.id.startsWith("default-") ? null : shiftTimes.id,
      created_by: createdBy,
      notes: `${shiftTimes.startTime}-${shiftTimes.endTime}`,
    });
  };

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
      // Get all assignments for this member this week (could be multiple if day-specific)
      const memberAssignments = weekAssignments.filter(
        (a) => a.user_id === member.user_id
      );

      if (memberAssignments.length === 0) {
        continue; // Skip if no assignments
      }

      // Handle day-specific assignments
      for (const assignment of memberAssignments) {
        if (!assignment.shift_type || assignment.shift_type === "off") {
          continue; // Skip off days
        }

        const shiftType = assignment.shift_type;
        const specificDayOfWeek = assignment.day_of_week;

        // Check if this is a compound shift (weekend + weekday)
        const isCompoundShift = shiftType.startsWith("weekend_");
        
        // If day_of_week is specified, only create entry for that day
        if (specificDayOfWeek !== null) {
          const dayOffset = specificDayOfWeek === 0 ? 6 : specificDayOfWeek - 1; // Convert ISO day to offset
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate <= endDate) {
            await buildEntry(member, entryDate, shiftType as ShiftTypeName);
          }
      } else if (isCompoundShift || assignment.include_weekends) {
        // Handle compound shifts OR weekday shift with include_weekends checkbox
        const weekdayShift = isCompoundShift 
          ? shiftType.replace("weekend_", "") as "normal" | "early" | "late"
          : shiftType as "normal" | "early" | "late";

        // Generate weekend entries (Sat/Sun) - uses member's country for correct times
        for (let dayOffset = 5; dayOffset <= 6; dayOffset++) {
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate > endDate) continue;
          await buildEntry(member, entryDate, "weekend");
        }

        // Generate weekday entries (Mon-Fri)
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const entryDate = addDays(currentDate, dayOffset);
          if (entryDate > endDate) continue;
          await buildEntry(member, entryDate, weekdayShift);
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
          await buildEntry(member, entryDate, simpleShiftType);
        }
        }
      }
    }

    currentDate = addWeeks(currentDate, 1);
    weekCounter++;
  }

  return { entries, warnings };
}

export async function validateRosterApprovals(
  rosterId: string
): Promise<{ allApproved: boolean; pendingManagers: string[] }> {
  try {
    const { data: approvals, error } = await supabase
      .from("roster_manager_approvals")
      .select(`
        approved,
        state,
        profiles!roster_manager_approvals_manager_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq("roster_id", rosterId);

    if (error) throw error;

    const pendingManagers = approvals
      .filter((a: any) => a.state !== "approved")
      .map((a: any) => `${a.profiles?.first_name ?? ""} ${a.profiles?.last_name ?? ""}`.trim());

    return {
      allApproved: approvals.length > 0 && pendingManagers.length === 0,
      pendingManagers,
    };
  } catch (error) {
    console.error("Error validating approvals:", error);
    return { allApproved: false, pendingManagers: [] };
  }
}
