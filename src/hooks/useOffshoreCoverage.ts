import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShiftCode } from "@/lib/offshorePattern";

export interface CoverageGap {
  date: string;
  code: string;
  shift_type: string | null;
  required: number;
  actual: number;
}

/**
 * Per-day coverage for an offshore roster: counts anchors per shift code
 * and compares against partnership_shift_requirements.
 * Defaults to a minimum of 1 for E, L, N when no requirement row exists.
 */
export function useOffshoreCoverage(
  partnershipId: string | null,
  rosterId: string | null,
  codes: ShiftCode[],
) {
  const [requirements, setRequirements] = useState<Record<string, number>>({});
  const [anchors, setAnchors] = useState<{ work_date: string; shift_code_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!partnershipId || !rosterId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [reqRes, asgRes] = await Promise.all([
        supabase
          .from("partnership_shift_requirements")
          .select("shift_type, staff_required")
          .eq("partnership_id", partnershipId),
        supabase
          .from("roster_day_assignments")
          .select("work_date, shift_code_id, is_anchor")
          .eq("roster_id", rosterId)
          .eq("is_anchor", true),
      ]);
      if (cancelled) return;
      const reqMap: Record<string, number> = {};
      (reqRes.data || []).forEach((r: any) => {
        if (r.shift_type) reqMap[r.shift_type.toLowerCase()] = r.staff_required;
      });
      setRequirements(reqMap);
      setAnchors((asgRes.data || []) as any);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [partnershipId, rosterId]);

  const gaps = useMemo<CoverageGap[]>(() => {
    if (codes.length === 0) return [];
    // Build counts keyed by date+shift_type
    const codesById = new Map(codes.map((c) => [c.id, c]));
    const counts = new Map<string, Map<string, number>>(); // date -> shift_type -> count
    const allDates = new Set<string>();
    anchors.forEach((a) => {
      if (!a.shift_code_id) return;
      const c = codesById.get(a.shift_code_id);
      if (!c?.is_working || !c.shift_type) return;
      allDates.add(a.work_date);
      if (!counts.has(a.work_date)) counts.set(a.work_date, new Map());
      const m = counts.get(a.work_date)!;
      m.set(c.shift_type, (m.get(c.shift_type) ?? 0) + 1);
    });

    // Tracked codes: only those with a shift_type matching tracked requirements
    // Default min = 1 for E/L/N if no explicit requirement.
    const trackedCodes = codes.filter(
      (c) => c.is_working && c.shift_type && ["early", "late", "night"].includes(c.shift_type),
    );

    const out: CoverageGap[] = [];
    allDates.forEach((date) => {
      trackedCodes.forEach((c) => {
        const required = requirements[c.shift_type!] ?? 1;
        if (required <= 0) return;
        const actual = counts.get(date)?.get(c.shift_type!) ?? 0;
        if (actual < required) {
          out.push({ date, code: c.code, shift_type: c.shift_type, required, actual });
        }
      });
    });
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.code.localeCompare(b.code)));
    return out;
  }, [anchors, codes, requirements]);

  return { gaps, loading, requirements };
}
