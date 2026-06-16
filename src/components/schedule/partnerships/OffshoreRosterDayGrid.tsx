import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Save } from "lucide-react";
import { usePartnershipShiftCodes } from "@/hooks/usePartnershipShiftCodes";
import { useRosterDayAssignments } from "@/hooks/useRosterDayAssignments";
import {
  applyShiftWithRecovery,
  DayAssignment,
  ShiftCode,
  validateRecovery,
  shadowsFor,
} from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";
import { usePartnershipShadowPairs } from "@/hooks/usePartnershipShadowPairs";
import { useOffshoreCoverage } from "@/hooks/useOffshoreCoverage";
import { Badge } from "@/components/ui/badge";

interface Props {
  partnershipId: string;
  rosterId: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;
  onClose?: () => void;
}

interface Member {
  id: string;
  display_name: string;
}

/**
 * Day-by-day grid editor for offshore rosters.
 * Click a cell to assign a shift code and repaint any configured recovery days.
 */
export function OffshoreRosterDayGrid({
  partnershipId,
  rosterId,
  startDate,
  endDate,
  onClose,
}: Props) {
  const { codes } = usePartnershipShiftCodes(partnershipId);
  const { assignments, replaceUserRange } = useRosterDayAssignments(rosterId);
  const { pairs: shadowPairs } = usePartnershipShadowPairs(partnershipId);
  const { gaps: coverageGaps } = useOffshoreCoverage(partnershipId, rosterId, codes);
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [dragDates, setDragDates] = useState<Set<string>>(new Set());
  const dragStateRef = useRef<{ userId: string | null; dates: Set<string> }>({
    userId: null,
    dates: new Set(),
  });
  const assignmentsRef = useRef<DayAssignment[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_partnership_team_members", {
        p_partnership_id: partnershipId,
      });

      if (error) {
        console.error("Error fetching offshore roster members:", error);
        toast({ title: "Failed to load roster members", variant: "destructive" });
        setMembers([]);
        return;
      }

      const uniqueMembers = new Map<string, Member>();
      (data || []).forEach((row) => {
        const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
        uniqueMembers.set(row.user_id, {
          id: row.user_id,
          display_name: displayName || row.initials || "User",
        });
      });

      setMembers(Array.from(uniqueMembers.values()).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    })();
  }, [partnershipId, toast]);

  const dates = useMemo(() => {
    const out: string[] = [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      out.push(format(d, "yyyy-MM-dd"));
    }
    return out;
  }, [startDate, endDate]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const d of dates) {
      const label = format(parseISO(d), "MMMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.count += 1;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [dates]);

  const firstOfMonthDates = useMemo(() => {
    const set = new Set<string>();
    let prevMonth = "";
    for (const d of dates) {
      const m = d.slice(0, 7);
      if (m !== prevMonth && prevMonth !== "") set.add(d);
      prevMonth = m;
    }
    return set;
  }, [dates]);

  const byUser = useMemo(() => {
    const map = new Map<string, Map<string, DayAssignment>>();
    assignments.forEach((a) => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.work_date, a);
    });
    return map;
  }, [assignments]);

  // Keep a live ref to assignments so paint handlers always see the latest
  // optimistic state, even when fired in quick succession.
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  const currentUserRows = (userId: string) =>
    assignmentsRef.current.filter((a) => a.user_id === userId);

  const paintDates = async (userId: string, dateList: string[]) => {
    if (!selectedCodeId) {
      toast({ title: "Select a shift code first" });
      return;
    }
    const shift = codes.find((c) => c.id === selectedCodeId);
    if (!shift || dateList.length === 0) return;
    let working = currentUserRows(userId);
    for (const d of dateList) {
      working = applyShiftWithRecovery(rosterId, userId, d, shift, codes, working);
    }
    const allDates = working.map((a) => a.work_date);
    const minDate = allDates.reduce((m, d) => (d < m ? d : m), startDate);
    const maxDate = allDates.reduce((m, d) => (d > m ? d : m), endDate);
    await replaceUserRange(userId, minDate, maxDate, working);

    // Auto-mirror onto shadow members for E/L/N codes
    const shadowIds = shadowsFor(userId, shift.code, shadowPairs as any);
    if (shadowIds.length === 0) return;
    let mirroredCount = 0;
    const skipped: string[] = [];
    for (const shadowId of shadowIds) {
      let shadowRows = currentUserRows(shadowId);
      const byDate = new Map(shadowRows.map((a) => [a.work_date, a]));
      const dirtyDates: string[] = [];
      for (const d of dateList) {
        const existing = byDate.get(d);
        // Skip if the shadow already has a manual non-WO anchor (e.g. vacation/training)
        if (existing && existing.is_anchor && existing.generated_by === "manual") {
          const existingCode = codes.find((c) => c.id === existing.shift_code_id);
          if (existingCode && existingCode.id !== shift.id) {
            skipped.push(`${d}`);
            continue;
          }
        }
        shadowRows = applyShiftWithRecovery(rosterId, shadowId, d, shift, codes, shadowRows);
        dirtyDates.push(d);
      }
      if (dirtyDates.length === 0) continue;
      mirroredCount += dirtyDates.length;
      const allShadowDates = shadowRows.map((a) => a.work_date);
      const minS = allShadowDates.reduce((m, d) => (d < m ? d : m), startDate);
      const maxS = allShadowDates.reduce((m, d) => (d > m ? d : m), endDate);
      await replaceUserRange(shadowId, minS, maxS, shadowRows);
    }
    if (mirroredCount > 0) {
      toast({
        title: `Shadow mirrored on ${shadowIds.length} member(s)`,
        description: skipped.length
          ? `Skipped ${skipped.length} day(s) with existing assignments`
          : undefined,
      });
    }
  };

  useEffect(() => {
    const onUp = () => {
      const { userId, dates: dset } = dragStateRef.current;
      if (userId && dset.size > 0) {
        const sorted = Array.from(dset).sort();
        void paintDates(userId, sorted);
      }
      dragStateRef.current = { userId: null, dates: new Set() };
      setDragUserId(null);
      setDragDates(new Set());
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCodeId, codes, assignments]);

  const startDrag = (userId: string, date: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!selectedCodeId) {
      toast({ title: "Select a shift code first" });
      return;
    }
    e.preventDefault();
    const set = new Set<string>([date]);
    dragStateRef.current = { userId, dates: set };
    setDragUserId(userId);
    setDragDates(new Set(set));
  };

  const extendDrag = (userId: string, date: string) => {
    if (!dragStateRef.current.userId || dragStateRef.current.userId !== userId) return;
    if (dragStateRef.current.dates.has(date)) return;
    dragStateRef.current.dates.add(date);
    setDragDates(new Set(dragStateRef.current.dates));
  };

  const clearCell = async (userId: string, date: string) => {
    const existing = currentUserRows(userId).filter((a) => a.work_date !== date);
    await replaceUserRange(userId, startDate, endDate, existing);
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      const dayCode = codes.find((c) => c.code.toUpperCase() === "D");
      if (!dayCode) {
        toast({
          title: "No Day code in palette — blank days were not filled",
          variant: "destructive",
        });
      } else {
        await Promise.all(
          members.map(async (m) => {
            const existing = currentUserRows(m.id);
            const filled = new Set(existing.map((a) => a.work_date));
            const additions: DayAssignment[] = [];
            for (const d of dates) {
              if (!filled.has(d)) {
                additions.push({
                  roster_id: rosterId,
                  user_id: m.id,
                  work_date: d,
                  shift_code_id: dayCode.id,
                  is_recovery: false,
                  is_anchor: true,
                  generated_by: "manual",
                });
              }
            }
            if (additions.length === 0) return;
            await replaceUserRange(m.id, startDate, endDate, [...existing, ...additions]);
          }),
        );
      }
      toast({ title: "Roster saved" });
      onClose?.();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to save roster", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const warnings = useMemo(() => {
    const out: { user: string; messages: string[] }[] = [];
    members.forEach((m) => {
      const list = Array.from(byUser.get(m.id)?.values() || []);
      const msgs = validateRecovery(list, codes);
      if (msgs.length) out.push({ user: m.display_name, messages: msgs });
    });
    return out;
  }, [members, byUser, codes]);

  const shortDates = useMemo(() => {
    const map = new Map<string, string[]>();
    coverageGaps.forEach((g) => {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(`${g.code}:${g.actual}/${g.required}`);
    });
    return map;
  }, [coverageGaps]);

  if (codes.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          No shift codes defined yet. Go to the <strong>Pattern</strong> tab and load the offshore preset.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {coverageGaps.length > 0 && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <div className="font-semibold">
              Coverage gap: {shortDates.size} day{shortDates.size === 1 ? "" : "s"} below minimum
              E/L/N staffing
            </div>
            <div className="mt-2 flex gap-1 flex-wrap max-h-24 overflow-auto">
              {Array.from(shortDates.entries())
                .slice(0, 60)
                .map(([d, parts]) => (
                  <Badge key={d} variant="outline" className="text-xs bg-background/40">
                    {format(parseISO(d), "MMM d")} — {parts.join(", ")}
                  </Badge>
                ))}
              {shortDates.size > 60 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{shortDates.size - 60} more
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Shift palette</CardTitle>
            <Button size="sm" onClick={handleSaveAndClose} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving…" : "Save & Close"}
            </Button>
          </div>
          <CardDescription>
            Pick a code, then click or drag across cells to assign. WO days only auto-fill around long blocks (more than 5 consecutive shifts); a single Early or Late shift does not produce a WO. Save & Close fills any remaining blank days with D — Day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {codes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCodeId(c.id)}
                className={`px-3 py-2 rounded text-white text-sm font-semibold ${
                  selectedCodeId === c.id ? "ring-2 ring-offset-2 ring-primary" : ""
                }`}
                style={{ backgroundColor: c.color }}
              >
                {c.code} <span className="font-normal opacity-90">— {c.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden min-w-0">
        <CardContent className="p-0 min-w-0">
          <div className="w-full min-w-0 max-h-[60vh] overflow-auto text-xs select-none">
            <div style={{ width: `${160 + dates.length * 40}px` }}>
              {/* Month header row */}
              <div className="flex sticky top-0 z-30 bg-background" style={{ height: 24 }}>
                <div
                  className="shrink-0 border-r border-b bg-background sticky left-0 z-40"
                  style={{ width: 160, height: 24 }}
                />
                {monthGroups.map((g, i) => (
                  <div
                    key={`${g.label}-${i}`}
                    className="shrink-0 border-r border-b bg-muted/40 flex items-center justify-center font-semibold text-xs box-border"
                    style={{ width: g.count * 40, height: 24 }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>

              {/* Day header row */}
              <div className="flex sticky bg-background z-20" style={{ top: 24, height: 48 }}>
                <div
                  className="shrink-0 border-r border-b bg-background sticky left-0 z-30 flex items-center px-2 font-medium box-border"
                  style={{ width: 160, height: 48 }}
                >
                  Member
                </div>
                {dates.map((d) => {
                  const dt = parseISO(d);
                  const dow = dt.getDay();
                  const weekend = dow === 0 || dow === 6;
                  const isMonthStart = firstOfMonthDates.has(d);
                  return (
                    <div
                      key={d}
                      className={`shrink-0 border-r border-b text-center flex flex-col justify-center box-border ${weekend ? "bg-muted" : "bg-background"}`}
                      style={{
                        width: 40,
                        height: 48,
                        borderLeft: isMonthStart ? "2px solid hsl(var(--border))" : undefined,
                      }}
                    >
                      <div className="font-normal text-muted-foreground leading-tight">
                        {format(dt, "EEE")[0]}
                      </div>
                      <div className="font-semibold leading-tight">{format(dt, "d")}</div>
                    </div>
                  );
                })}
              </div>

              {/* Body rows */}
              {members.map((m) => (
                <div key={m.id} className="flex" style={{ height: 36 }}>
                  <div
                    className="shrink-0 border-r border-b bg-background sticky left-0 z-10 flex items-center px-2 font-medium truncate box-border"
                    style={{ width: 160, height: 36 }}
                    title={m.display_name}
                  >
                    {m.display_name}
                  </div>
                  {dates.map((d) => {
                    const a = byUser.get(m.id)?.get(d);
                    const c = a ? codes.find((x) => x.id === a.shift_code_id) : null;
                    const isDragHighlighted = dragUserId === m.id && dragDates.has(d);
                    const dow = parseISO(d).getDay();
                    const weekend = dow === 0 || dow === 6;
                    const isMonthStart = firstOfMonthDates.has(d);
                    const isShort = shortDates.has(d);
                    return (
                      <div
                        key={d}
                        className={`shrink-0 border-r border-b text-center cursor-cell hover:opacity-80 flex items-center justify-center box-border ${
                          isDragHighlighted ? "ring-2 ring-inset ring-primary" : ""
                        } ${!c && weekend ? "bg-muted/50" : ""} ${isShort ? "shadow-[inset_0_2px_0_0_hsl(var(--destructive))]" : ""}`}
                        style={{
                          width: 40,
                          height: 36,
                          backgroundColor: c ? c.color : undefined,
                          borderLeft: isMonthStart ? "2px solid hsl(var(--border))" : undefined,
                        }}
                        onMouseDown={(e) => startDrag(m.id, d, e)}
                        onMouseEnter={() => extendDrag(m.id, d)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          clearCell(m.id, d);
                        }}
                        title={
                          (isShort ? `Short staffing: ${shortDates.get(d)!.join(", ")}\n` : "") +
                          (c ? `${c.label}${a?.is_anchor ? "" : " (auto)"}` : "Click to assign")
                        }
                      >
                        <span className={c ? "text-white font-semibold" : ""}>
                          {c?.code ?? ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Left-click or drag = assign selected code · Right-click = clear cell
      </p>

      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Recovery rule warnings:</p>
              {warnings.map((w) => (
                <div key={w.user} className="text-xs">
                  <span className="font-medium">{w.user}:</span> {w.messages.join("; ")}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}