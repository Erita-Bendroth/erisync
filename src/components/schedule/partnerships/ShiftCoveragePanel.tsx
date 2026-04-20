import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { resolveShiftDefinition, type ShiftDefinitionRow, type ShiftTypeName } from "@/lib/shiftResolver";
import { normalizeCountryCode } from "@/lib/countryCodeUtils";

const SHIFT_TYPES: ShiftTypeName[] = ["normal", "early", "late", "weekend"];

interface ShiftCoveragePanelProps {
  partnershipId: string;
}

type CellStatus = "ok" | "missing" | "ambiguous" | "default";

interface CellResult {
  status: CellStatus;
  detail?: string;
}

export function ShiftCoveragePanel({ partnershipId }: ShiftCoveragePanelProps) {
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<ShiftTypeName, CellResult>>>({});
  const [hasMissing, setHasMissing] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnershipId]);

  async function load() {
    setLoading(true);
    try {
      const { data: partnership } = await supabase
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", partnershipId)
        .single();
      const teamIds: string[] = partnership?.team_ids ?? [];
      if (teamIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, profiles!team_members_user_id_fkey(country_code)")
        .in("team_id", teamIds);

      const countrySet = new Set<string>();
      const memberByCountry = new Map<string, string[]>();
      (members ?? []).forEach((m: any) => {
        const c = normalizeCountryCode(m.profiles?.country_code);
        if (!c) return;
        countrySet.add(c);
        if (!memberByCountry.has(c)) memberByCountry.set(c, []);
        memberByCountry.get(c)!.push(m.team_id);
      });
      const countryList = Array.from(countrySet).sort();

      const { data: defs } = await supabase
        .from("shift_time_definitions")
        .select("id, shift_type, team_id, team_ids, country_codes, day_of_week, start_time, end_time, description");

      const result: Record<string, Record<ShiftTypeName, CellResult>> = {};
      let anyMissing = false;

      for (const country of countryList) {
        result[country] = {} as any;
        const teamForCountry = memberByCountry.get(country)?.[0] ?? null;
        for (const st of SHIFT_TYPES) {
          // Sample: a Wednesday for weekday types, Saturday for weekend
          const sampleDate = st === "weekend" ? "2025-06-07" : "2025-06-04";
          const r = resolveShiftDefinition(
            { shiftType: st, date: sampleDate, personCountry: country, teamId: teamForCountry },
            (defs ?? []) as ShiftDefinitionRow[]
          );
          if (r.ok) {
            result[country][st] = { status: "ok", detail: r.matchedTier };
            continue;
          }
          result[country][st] = {
            status: r.reason === "ambiguous" ? "ambiguous" : "missing",
            detail: r.message,
          };
          if (r.reason === "no_match") anyMissing = true;
        }
      }

      setCountries(countryList);
      setMatrix(result);
      setHasMissing(anyMissing);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (countries.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">Shift Rule Coverage</h4>
        {hasMissing ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Gaps detected
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> All countries covered
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="text-left">
              <th className="px-2 py-1">Country</th>
              {SHIFT_TYPES.map((st) => (
                <th key={st} className="px-2 py-1 capitalize">{st}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c} className="border-t">
                <td className="px-2 py-1 font-medium">{c}</td>
                {SHIFT_TYPES.map((st) => {
                  const cell = matrix[c]?.[st];
                  const cls =
                    cell?.status === "ok"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : cell?.status === "ambiguous"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-destructive/10 text-destructive";
                  return (
                    <td key={st} className="px-2 py-1">
                      <span className={`inline-block rounded px-2 py-0.5 ${cls}`} title={cell?.detail}>
                        {cell?.status === "ok" ? "OK" : cell?.status === "ambiguous" ? "AMBIGUOUS" : "MISSING"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMissing && (
        <p className="text-xs text-muted-foreground mt-2">
          Add the missing shift definitions in admin before generating schedules to avoid silent fallback to built-in defaults.
        </p>
      )}
    </Card>
  );
}