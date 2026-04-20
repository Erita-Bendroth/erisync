import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface UseScheduleEntriesParams {
  userIds?: string[];
  teamIds?: string[];
  startDate: Date | string;
  endDate: Date | string;
  includeProfiles?: boolean;
  includeTeams?: boolean;
  enabled?: boolean;
}

const toDateStr = (d: Date | string) =>
  typeof d === "string" ? d : format(d, "yyyy-MM-dd");

/**
 * Standardised React Query hook for fetching `schedule_entries`.
 *
 * Centralises the query key shape so consumers share cache entries:
 *   ["schedule-entries", { userIds, teamIds, startDate, endDate }]
 *
 * Migrate consumers incrementally — old ad-hoc useQuery calls keep working.
 */
export function useScheduleEntries(params: UseScheduleEntriesParams) {
  const {
    userIds,
    teamIds,
    startDate,
    endDate,
    includeProfiles = false,
    includeTeams = false,
    enabled = true,
  } = params;

  const start = toDateStr(startDate);
  const end = toDateStr(endDate);

  const sortedUserIds = userIds ? [...userIds].sort() : undefined;
  const sortedTeamIds = teamIds ? [...teamIds].sort() : undefined;

  return useQuery({
    queryKey: [
      "schedule-entries",
      {
        userIds: sortedUserIds,
        teamIds: sortedTeamIds,
        startDate: start,
        endDate: end,
        includeProfiles,
        includeTeams,
      },
    ],
    queryFn: async () => {
      const select = [
        "*",
        includeProfiles ? "profiles:user_id (first_name, last_name, initials)" : null,
        includeTeams ? "teams:team_id (name)" : null,
      ]
        .filter(Boolean)
        .join(", ");

      let query = supabase
        .from("schedule_entries")
        .select(select)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (sortedUserIds && sortedUserIds.length > 0) {
        query = query.in("user_id", sortedUserIds);
      }
      if (sortedTeamIds && sortedTeamIds.length > 0) {
        query = query.in("team_id", sortedTeamIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled:
      enabled &&
      ((sortedUserIds?.length ?? 0) > 0 || (sortedTeamIds?.length ?? 0) > 0),
  });
}
