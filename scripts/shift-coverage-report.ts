/**
 * Admin utility: pulls live shift definitions from Supabase and prints a
 * country × shiftType coverage report. Run with:
 *
 *   npx tsx scripts/shift-coverage-report.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or anon key for
 * read-only access if RLS allows).
 */
import { createClient } from "@supabase/supabase-js";
import { generateCoverageReport, formatCoverageReportMarkdown } from "../src/lib/shiftCoverageReport";
import { listSupportedCountries } from "../src/lib/timezoneUtils";
import type { ShiftDefinitionRow, ShiftTypeName } from "../src/lib/shiftResolver";

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_*_KEY env vars");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("shift_time_definitions")
    .select("id, shift_type, team_id, team_ids, country_codes, day_of_week, start_time, end_time, description");
  if (error) {
    console.error("Failed to fetch definitions:", error.message);
    process.exit(1);
  }

  const definitions = (data ?? []) as ShiftDefinitionRow[];
  const countries = listSupportedCountries();
  const shiftTypes: ShiftTypeName[] = ["normal", "early", "late", "weekend"];

  const cells = generateCoverageReport(definitions, countries, shiftTypes);
  console.log("# Shift Rule Coverage Report\n");
  console.log(formatCoverageReportMarkdown(cells));

  const issues = cells.filter((c) => c.status !== "ok");
  if (issues.length > 0) {
    console.log(`\n## Issues (${issues.length})\n`);
    for (const c of issues) {
      console.log(`- [${c.status.toUpperCase()}] ${c.country} / ${c.shiftType}` + (c.candidates ? ` candidates=${c.candidates.join(",")}` : ""));
    }
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});