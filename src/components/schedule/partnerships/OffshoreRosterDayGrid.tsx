import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { usePartnershipShiftCodes } from "@/hooks/usePartnershipShiftCodes";
import { useRosterDayAssignments } from "@/hooks/useRosterDayAssignments";
import {
  applyShiftWithRecovery,
  DayAssignment,
  ShiftCode,
  validateRecovery,
} from "@/lib/offshorePattern";
import { useToast } from "@/hooks/use-toast";

interface Props {
  partnershipId: string;
  rosterId: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;
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
}: Props) {
  const { codes } = usePartnershipShiftCodes(partnershipId);
  const { assignments, replaceUserRange } = useRosterDayAssignments(rosterId);
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: partnership } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();
      if (!partnership?.team_ids?.length) return;
      const { data: tm } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", partnership.team_ids);
      const userIds = Array.from(new Set((tm || []).map((r: any) => r.user_id)));
      if (!userIds.length) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", userIds);
      setMembers(
        (profs || []).map((p: any) => ({
          id: p.id,
          display_name: p.display_name || p.full_name || "User",
        })),
      );
    })();
  }, [partnershipId]);

  const dates = useMemo(() => {
    const out: string[] = [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      out.push(format(d, "yyyy-MM-dd"));
    }
    return out;
  }, [startDate, endDate]);

  const byUser = useMemo(() => {
    const map = new Map<string, Map<string, DayAssignment>>();
    assignments.forEach((a) => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.work_date, a);
    });
    return map;
  }, [assignments]);

  const handleCellClick = async (userId: string, date: string) => {
    if (!selectedCodeId) {
      toast({ title: "Select a shift code first" });
      return;
    }
    const shift = codes.find((c) => c.id === selectedCodeId);
    if (!shift) return;
    const existing = Array.from(byUser.get(userId)?.values() || []);
    const next = applyShiftWithRecovery(rosterId, userId, date, shift, codes, existing);
    // Widen the save range so any auto-painted WO that lands just outside the
    // visible window (e.g. clicking on the last visible day) still gets saved.
    const allDates = next.map((a) => a.work_date);
    const minDate = allDates.reduce((m, d) => (d < m ? d : m), startDate);
    const maxDate = allDates.reduce((m, d) => (d > m ? d : m), endDate);
    await replaceUserRange(userId, minDate, maxDate, next);
  };

  const clearCell = async (userId: string, date: string) => {
    const existing = Array.from(byUser.get(userId)?.values() || []).filter((a) => a.work_date !== date);
    await replaceUserRange(userId, startDate, endDate, existing);
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shift palette</CardTitle>
          <CardDescription>
            Pick a code, then click cells to assign. WO days only auto-fill for codes that explicitly require recovery.
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

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background p-2 border text-left min-w-32">Member</th>
                {dates.map((d) => {
                  const dt = parseISO(d);
                  const dow = dt.getDay();
                  const weekend = dow === 0 || dow === 6;
                  return (
                    <th
                      key={d}
                      className={`p-1 border text-center min-w-10 ${weekend ? "bg-muted" : ""}`}
                    >
                      <div className="font-normal text-muted-foreground">{format(dt, "EEE")[0]}</div>
                      <div className="font-semibold">{format(dt, "d")}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="sticky left-0 bg-background p-2 border text-left font-medium">
                    {m.display_name}
                  </td>
                  {dates.map((d) => {
                    const a = byUser.get(m.id)?.get(d);
                    const c = a ? codes.find((x) => x.id === a.shift_code_id) : null;
                    return (
                      <td
                        key={d}
                        className="p-0 border text-center cursor-pointer hover:opacity-80"
                        style={c ? { backgroundColor: c.color } : {}}
                        onClick={() => handleCellClick(m.id, d)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          clearCell(m.id, d);
                        }}
                        title={c ? `${c.label}${a?.is_anchor ? "" : " (auto)"}` : "Click to assign"}
                      >
                        <span className={`block p-1 ${c ? "text-white font-semibold" : ""}`}>
                          {c?.code ?? ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Left-click = assign selected code · Right-click = clear cell
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