import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DayAssignment } from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";

export function useRosterDayAssignments(rosterId: string | null) {
  const [assignments, setAssignments] = useState<DayAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
    setAssignments((data || []) as DayAssignment[]);
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
      await supabase
        .from("roster_day_assignments")
        .delete()
        .eq("roster_id", rosterId)
        .eq("user_id", userId)
        .gte("work_date", fromDate)
        .lte("work_date", toDate);
      const toInsert = next
        .filter((a) => a.work_date >= fromDate && a.work_date <= toDate)
        .map(({ id: _id, created_at: _createdAt, updated_at: _updatedAt, ...rest }: DayAssignment & {
          created_at?: string | null;
          updated_at?: string | null;
        }) => rest);
      if (toInsert.length) {
        const { error } = await supabase
          .from("roster_day_assignments")
          .insert(toInsert);
        if (error) {
          toast({ title: "Save failed", description: error.message, variant: "destructive" });
          return;
        }
      }
      await load();
    },
    [rosterId, toast, load],
  );

  return { assignments, loading, reload: load, replaceUserRange, setLocal: setAssignments };
}