import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { useOffshoreScheduleCoverage } from "@/hooks/useOffshoreScheduleCoverage";
import { format, parseISO } from "date-fns";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { useOpenShiftRequests } from "@/hooks/useOpenShiftRequests";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  teamIds: string[];
  startDate: Date | null;
  endDate: Date | null;
}

const SHIFT_LABEL: Record<string, string> = { early: "E", late: "L", night: "N" };
const SHIFT_TYPES = ["early", "late", "night"] as const;

export function OffshoreCoverageBanner({ teamIds, startDate, endDate }: Props) {
  const { gaps, isOffshore, partnershipId } = useOffshoreScheduleCoverage(teamIds, startDate, endDate);
  const [expanded, setExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { roles, teams } = useCurrentUserContext();
  const isPrivileged = roles.includes("admin") || roles.includes("planner") || roles.includes("manager");
  const { requests: openRequests, refetch } = useOpenShiftRequests(teamIds);
  const { toast } = useToast();

  const openKeys = useMemo(
    () => new Set(openRequests.map((r) => `${r.shift_date}|${r.shift_type}`)),
    [openRequests],
  );

  const requestCoverage = async (date: string, shift: string) => {
    const key = `${date}|${shift}`;
    setBusyKey(key);
    try {
      // pick the first team the caller belongs to within the visible set
      const callerTeam = teams.find((t) => teamIds.includes(t.id))?.id ?? teamIds[0];
      const { data, error } = await supabase.functions.invoke("request-shift-coverage", {
        body: {
          team_id: callerTeam,
          partnership_id: partnershipId,
          shift_date: date,
          shift_type: shift,
        },
      });
      if (error) throw error;
      const notified = (data as any)?.notified ?? 0;
      toast({
        title: "Coverage request sent",
        description: `Notified ${notified} team member${notified === 1 ? "" : "s"}.`,
      });
      await refetch();
    } catch (e: any) {
      toast({
        title: "Could not send request",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    gaps.forEach((g) => {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(`${SHIFT_LABEL[g.shift_type] ?? g.shift_type} (${g.actual}/${g.required})`);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [gaps]);

  const gapsByDate = useMemo(() => {
    const m = new Map<string, typeof gaps>();
    gaps.forEach((g) => {
      if (!m.has(g.date)) m.set(g.date, [] as any);
      m.get(g.date)!.push(g);
    });
    return m;
  }, [gaps]);

  if (!isOffshore || gaps.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold">
            Coverage gap: {grouped.length} day{grouped.length === 1 ? "" : "s"} below minimum
            E/L/N staffing
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} details
          </Button>
        </div>
        {expanded && (
          <div className="mt-3 max-h-64 overflow-auto text-xs space-y-2">
            {Array.from(gapsByDate.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, dayGaps]) => (
              <div key={date} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium tabular-nums w-32">
                  {format(parseISO(date), "EEE, MMM d")}
                </span>
                {dayGaps.map((g) => {
                  const key = `${g.date}|${g.shift_type}`;
                  const already = openKeys.has(key);
                  return (
                    <div key={key} className="flex items-center gap-1">
                      <Badge variant="outline" className="bg-background/40">
                        {SHIFT_LABEL[g.shift_type] ?? g.shift_type} ({g.actual}/{g.required})
                      </Badge>
                      {isPrivileged && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={busyKey === key || already}
                          onClick={() => requestCoverage(g.date, g.shift_type)}
                        >
                          {busyKey === key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : already ? (
                            "Sent"
                          ) : (
                            <>
                              <Send className="h-3 w-3 mr-1" />
                              Request coverage
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
