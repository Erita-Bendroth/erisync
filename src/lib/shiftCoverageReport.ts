import { resolveShiftDefinition, type ShiftDefinitionRow, type ShiftTypeName } from "./shiftResolver";

export interface CoverageCell {
  country: string;
  shiftType: ShiftTypeName;
  status: "ok" | "missing" | "ambiguous";
  ruleId?: string;
  ruleDescription?: string;
  matchedTier?: string;
  candidates?: string[];
}

/**
 * Generate a country × shiftType coverage matrix.
 * Uses a representative weekday (Wednesday) and weekend day (Saturday) to
 * resolve each cell so day-restricted rules are exercised fairly.
 */
export function generateCoverageReport(
  definitions: ShiftDefinitionRow[],
  countries: string[],
  shiftTypes: ShiftTypeName[] = ["normal", "early", "late", "weekend"]
): CoverageCell[] {
  const cells: CoverageCell[] = [];
  // 2025-01-08 = Wednesday, 2025-01-11 = Saturday
  const weekday = new Date("2025-01-08T00:00:00Z");
  const weekend = new Date("2025-01-11T00:00:00Z");

  for (const country of countries) {
    for (const shiftType of shiftTypes) {
      const date = shiftType === "weekend" ? weekend : weekday;
      const result = resolveShiftDefinition(
        { shiftType, date, personCountry: country, teamId: null },
        definitions
      );
      if (result.ok) {
        cells.push({
          country,
          shiftType,
          status: "ok",
          ruleId: result.definition.id,
          ruleDescription: result.definition.description ?? `${result.definition.start_time}–${result.definition.end_time}`,
          matchedTier: result.matchedTier,
        });
      } else {
        cells.push({
          country,
          shiftType,
          status: result.reason === "ambiguous" ? "ambiguous" : "missing",
          candidates: result.candidates.map((c) => c.id),
        });
      }
    }
  }
  return cells;
}

export function formatCoverageReportMarkdown(cells: CoverageCell[]): string {
  const countries = Array.from(new Set(cells.map((c) => c.country))).sort();
  const shiftTypes = Array.from(new Set(cells.map((c) => c.shiftType)));
  const header = `| Country | ${shiftTypes.join(" | ")} |`;
  const sep = `| --- | ${shiftTypes.map(() => "---").join(" | ")} |`;
  const rows = countries.map((country) => {
    const cols = shiftTypes.map((st) => {
      const cell = cells.find((c) => c.country === country && c.shiftType === st);
      if (!cell) return "—";
      if (cell.status === "ok") return `✅ ${cell.ruleDescription} _(${cell.matchedTier})_`;
      if (cell.status === "ambiguous") return `⚠️ AMBIGUOUS (${cell.candidates?.length ?? 0})`;
      return "❌ MISSING";
    });
    return `| ${country} | ${cols.join(" | ")} |`;
  });
  return [header, sep, ...rows].join("\n");
}