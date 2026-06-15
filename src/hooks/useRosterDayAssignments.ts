import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DayAssignment } from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";

export function useRosterDayAssignments(rosterId: string | null) {
  const [assignments, setAssignments] = useState<DayAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const assignmentsRef = useRef<DayAssignment[]>([]);
  const pendingByUser = useRef<Map<string, Promise<void>>>(new Map());

  // Keep ref in sync so chained saves can read the latest optimistic state
  // even before React re-renders.
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  const load = useCallback(async () => {
    if (!rosterId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("roster_day_assignments")
      .select("*")
      .eq("roster_id", rosterId)
      .order("work_date", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data || []) as DayAssignment[];
    assignmentsRef.current = rows;
    setAssignments(rows);
  }, [rosterId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Replace all assignments for a given user within the date range.
   * Used after auto-recovery painting recomputes the user's row.
   */
  const replaceUserRange = useCallback(
    async (
      userId: string,
      fromDate: string,
      toDate: string,
      next: DayAssignment[],
    ) => {
      if (!rosterId) return;

      // Optimistically update local state immediately so the grid never
      // shows a stale or empty value between paint and DB ack.
      const previous = assignmentsRef.current;
      const inRangeNext = next.filter(
        (a) => a.work_date >= fromDate && a.work_date <= toDate,
      );
      const optimistic = [
        ...previous.filter(
          (a) =>
            !(
              a.user_id === userId &&
              a.work_date >= fromDate &&
              a.work_date <= toDate
            ),
        ),
        ...inRangeNext,
      ];
      assignmentsRef.current = optimistic;
      setAssignments(optimistic);

      // Serialize writes per-user so a fast second paint can't race the
      // delete from the first paint and wipe just-inserted rows.
      const prevTail = pendingByUser.current.get(userId) ?? Promise.resolve();
      const task = prevTail.then(async () => {
        const { error: delErr } = await supabase
          .from("roster_day_assignments")
          .delete()
          .eq("roster_id", rosterId)
          .eq("user_id", userId)
          .gte("work_date", fromDate)
          .lte("work_date", toDate);
        if (delErr) throw delErr;

        const toInsert = inRangeNext.map(
          ({ id: _id, created_at: _c, updated_at: _u, ...rest }: DayAssignment & {
            created_at?: string | null;
            updated_at?: string | null;
          }) => rest,
        );
        if (toInsert.length) {
          const { error: insErr } = await supabase
            .from("roster_day_assignments")
            .insert(toInsert);
          if (insErr) throw insErr;
        }
      }).catch((err) => {
        console.error("Roster save failed:", err);
        toast({
          title: "Save failed",
          description: err?.message ?? String(err),
          variant: "destructive",
        });
        // Roll back optimistic update
        assignmentsRef.current = previous;
        setAssignments(previous);
      }).finally(() => {
        if (pendingByUser.current.get(userId) === task) {
          pendingByUser.current.delete(userId);
        }
      });
      pendingByUser.current.set(userId, task);
      await task;
    },
    [rosterId, toast],
  );

  return { assignments, loading, reload: load, replaceUserRange, setLocal: setAssignments };
}