import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { format } from "date-fns";

export interface SubstituteAssignment {
  id: string;
  date: string;
  team_id: string;
  absent_user_id: string;
  substitute_user_id: string;
  absence_entry_id: string | null;
  reason?: string | null;
  notes?: string | null;
}

interface UseSubstituteAssignmentsParams {
  teamIds?: string[];
  startDate: Date | string;
  endDate: Date | string;
  enabled?: boolean;
}

const toDateStr = (d: Date | string) =>
  typeof d === "string" ? d : format(d, "yyyy-MM-dd");

/**
 * Fetches substitute assignments. Managers/admins/planners read from the base
 * table (with reason + notes). Everyone else reads from the public view
 * (no reason, no notes).
 */
export function useSubstituteAssignments(params: UseSubstituteAssignmentsParams) {
  const { teamIds, startDate, endDate, enabled = true } = params;
  const { roles } = useCurrentUserContext();

  const isPrivileged =
    roles.includes("admin") ||
    roles.includes("planner") ||
    roles.includes("manager");

  const start = toDateStr(startDate);
  const end = toDateStr(endDate);
  const sortedTeamIds = teamIds ? [...teamIds].sort() : undefined;

  return useQuery({
    queryKey: [
      "substitute-assignments",
      { teamIds: sortedTeamIds, start, end, privileged: isPrivileged },
    ],
    queryFn: async () => {
      const source = isPrivileged
        ? "substitute_assignments"
        : "substitute_assignments_public";

      let query = supabase
        .from(source as any)
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (sortedTeamIds && sortedTeamIds.length > 0) {
        query = query.in("team_id", sortedTeamIds);
      }

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data ?? []) as SubstituteAssignment[];
    },
    enabled: enabled && (sortedTeamIds?.length ?? 0) >= 0,
  });
}

/** Convenience: index by `${date}|${absent_user_id}` for O(1) lookup. */
export function indexByAbsence(rows: SubstituteAssignment[] | undefined) {
  const map = new Map<string, SubstituteAssignment>();
  (rows ?? []).forEach((r) => map.set(`${r.date}|${r.absent_user_id}`, r));
  return map;
}

/** Convenience: index by `${date}|${substitute_user_id}`. */
export function indexBySubstitute(rows: SubstituteAssignment[] | undefined) {
  const map = new Map<string, SubstituteAssignment>();
  (rows ?? []).forEach((r) => map.set(`${r.date}|${r.substitute_user_id}`, r));
  return map;
}

export interface UpsertSubstituteInput {
  date: string;
  team_id: string;
  absent_user_id: string;
  substitute_user_id: string;
  reason?: string | null;
  notes?: string | null;
}

export function useUpsertSubstituteAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertSubstituteInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("substitute_assignments")
        .upsert(
          {
            date: input.date,
            team_id: input.team_id,
            absent_user_id: input.absent_user_id,
            substitute_user_id: input.substitute_user_id,
            reason: input.reason ?? null,
            notes: input.notes ?? null,
            created_by: userId,
          },
          { onConflict: "date,team_id,absent_user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as SubstituteAssignment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitute-assignments"] });
      qc.invalidateQueries({ queryKey: ["schedule-entries"] });
    },
  });
}

export function useDeleteSubstituteAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("substitute_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitute-assignments"] });
      qc.invalidateQueries({ queryKey: ["schedule-entries"] });
    },
  });
}