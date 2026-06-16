import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleCoverageGap {
  date: string;
  shift_type: "early" | "late" | "night";
  required: number;
  actual: number;
}

/**
 * Coverage check for live schedule_entries against an offshore partnership's
 * E/L/N minimum staffing. Only runs when at least one of the supplied teamIds
 * belongs to a partnership in offshore_mode.
 */
export function useOffshoreScheduleCoverage(
  teamIds: string[],
  startDate: Date | null,
  endDate: Date | null,
) {
  const [partnershipId, setPartnershipId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<{ date: string; shift_type: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const teamKey = teamIds.slice().sort().join(",");
  const rangeKey =
    startDate && endDate ? `${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}` : "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (teamIds.length === 0 || !startDate || !endDate) {
        setPartnershipId(null);
        setEntries([]);
        return;
      }
      setLoading(true);
      // 1) Find an offshore partnership that overlaps any of our teamIds.
      const { data: parts } = await supabase
        .from("team_planning_partners")
        .select("id, team_ids");
      if (cancelled) return;
      const matched = (parts || []).find((p: any) =>
        Array.isArray(p.team_ids) && p.team_ids.some((t: string) => teamIds.includes(t)),
      );
      if (!matched) {
        setPartnershipId(null);
        setEntries([]);
        setLoading(false);
        return;
      }
      // 2) Confirm it's offshore_mode via any of its rosters.
      const { data: rosters } = await supabase
        .from("partnership_rotation_rosters")
        .select("offshore_mode")
        .eq("partnership_id", matched.id)
        .eq("offshore_mode", true)
        .limit(1);
      if (cancelled) return;
      if (!rosters || rosters.length === 0) {
        setPartnershipId(null);
        setEntries([]);
        setLoading(false);
        return;
      }
      setPartnershipId(matched.id);

      // 3) Requirements + schedule entries for all teams in the partnership.
      const partnershipTeamIds = (matched as any).team_ids as string[];
      const pageSize = 1000;
      const fetchAllEntries = async () => {
        const all: any[] = [];
        let from = 0;
        for (let i = 0; i < 50; i++) {
          const { data, error } = await supabase
            .from("schedule_entries")
            .select("date, shift_type, availability_status, activity_type")
            .in("team_id", partnershipTeamIds)
            .gte("date", format(startDate, "yyyy-MM-dd"))
            .lte("date", format(endDate, "yyyy-MM-dd"))
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const rows = (data || []) as any[];
          all.push(...rows);
          if (rows.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const [reqRes, entryRows] = await Promise.all([
        supabase
          .from("partnership_shift_requirements")
          .select("shift_type, staff_required")
          .eq("partnership_id", matched.id),
        fetchAllEntries().catch((err) => {
          console.error("useOffshoreScheduleCoverage: failed to load entries", err);
          return [];
        }),
      ]);
      if (cancelled) return;
      const reqMap: Record<string, number> = {};
      (reqRes.data || []).forEach((r: any) => {
        if (r.shift_type) reqMap[r.shift_type.toLowerCase()] = r.staff_required;
      });
      setRequirements(reqMap);
      // Only count actually-working entries
      const working = entryRows.filter(
        (e: any) => e.availability_status === "available" && e.activity_type === "work",
      );
      setEntries(working.map((e: any) => ({ date: e.date, shift_type: e.shift_type })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey, rangeKey]);

  const gaps = useMemo<ScheduleCoverageGap[]>(() => {
    if (!partnershipId || !startDate || !endDate) return [];
    // Count per date per shift_type
    const counts = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();
    entries.forEach((e) => {
      if (!e.shift_type) return;
      allDates.add(e.date);
      if (!counts.has(e.date)) counts.set(e.date, new Map());
      const m = counts.get(e.date)!;
      m.set(e.shift_type, (m.get(e.shift_type) ?? 0) + 1);
    });
    // Generate every day in range so gaps where 0 anchors exist still show up
    const out: ScheduleCoverageGap[] = [];
    const day = new Date(startDate);
    while (day <= endDate) {
      const key = format(day, "yyyy-MM-dd");
      (["early", "late", "night"] as const).forEach((st) => {
        const required = requirements[st] ?? 1;
        if (required <= 0) return;
        const actual = counts.get(key)?.get(st) ?? 0;
        if (actual < required) out.push({ date: key, shift_type: st, required, actual });
      });
      day.setDate(day.getDate() + 1);
    }
    return out;
  }, [entries, requirements, partnershipId, startDate, endDate]);

  return { gaps, loading, isOffshore: !!partnershipId, partnershipId };
}
