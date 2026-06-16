import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useOffshoreScheduleCoverage } from "@/hooks/useOffshoreScheduleCoverage";
import { format, parseISO } from "date-fns";

interface Props {
  teamIds: string[];
  startDate: Date | null;
  endDate: Date | null;
}

const SHIFT_LABEL: Record<string, string> = { early: "E", late: "L", night: "N" };

export function OffshoreCoverageBanner({ teamIds, startDate, endDate }: Props) {
  const { gaps, isOffshore } = useOffshoreScheduleCoverage(teamIds, startDate, endDate);
  const [expanded, setExpanded] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    gaps.forEach((g) => {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(`${SHIFT_LABEL[g.shift_type] ?? g.shift_type} (${g.actual}/${g.required})`);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
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
          <div className="mt-3 max-h-48 overflow-auto text-xs space-y-1">
            {grouped.map(([date, shifts]) => (
              <div key={date} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium tabular-nums">
                  {format(parseISO(date), "EEE, MMM d")}
                </span>
                {shifts.map((s, i) => (
                  <Badge key={i} variant="outline" className="bg-background/40">
                    {s}
                  </Badge>
                ))}
              </div>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
