import { matchesCountryCode, normalizeCountryCode } from "./countryCodeUtils";

export type ShiftTypeName = "normal" | "early" | "late" | "weekend";

export interface ShiftDefinitionRow {
  id: string;
  shift_type: ShiftTypeName;
  team_id: string | null;
  team_ids: string[] | null;
  country_codes: string[] | null;
  day_of_week: number[] | null;
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;
  description: string | null;
}

export interface ResolveInput {
  shiftType: ShiftTypeName;
  date: Date | string; // used to derive day_of_week
  personCountry?: string | null;
  teamId?: string | null;
  isPublicHoliday?: boolean; // optional override for weekend rule
}

export type ResolveResult =
  | {
      ok: true;
      definition: ShiftDefinitionRow;
      matchedTier:
        | "team_country_day"
        | "team_country"
        | "country_day"
        | "country"
        | "global";
    }
  | {
      ok: false;
      reason: "no_match" | "ambiguous";
      message: string;
      candidates: ShiftDefinitionRow[];
    };

function getDayOfWeek(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getUTCDay();
}

function defMatchesTeam(def: ShiftDefinitionRow, teamId?: string | null) {
  if (!teamId) return false;
  if (def.team_id === teamId) return true;
  if (Array.isArray(def.team_ids) && def.team_ids.includes(teamId)) return true;
  return false;
}

function defHasNoTeam(def: ShiftDefinitionRow) {
  return (
    def.team_id == null &&
    (def.team_ids == null || (Array.isArray(def.team_ids) && def.team_ids.length === 0))
  );
}

function defHasNoCountry(def: ShiftDefinitionRow) {
  return (
    def.country_codes == null ||
    (Array.isArray(def.country_codes) && def.country_codes.length === 0)
  );
}

function defMatchesDay(def: ShiftDefinitionRow, dayOfWeek: number) {
  return (
    Array.isArray(def.day_of_week) &&
    def.day_of_week.length > 0 &&
    def.day_of_week.includes(dayOfWeek)
  );
}

function defHasNoDay(def: ShiftDefinitionRow) {
  return (
    def.day_of_week == null ||
    (Array.isArray(def.day_of_week) && def.day_of_week.length === 0)
  );
}

/**
 * Strict resolver: returns exactly one definition per (shiftType, person, team, date)
 * or an explicit error (no_match | ambiguous).
 *
 * Priority tiers (highest first):
 *   1. team + country (+ matching day)
 *   2. team + country (no day restriction)
 *   3. country only (+ matching day)
 *   4. country only (no day restriction)
 *   5. global (no team, no country)
 *
 * Ambiguity: within the winning tier, if more than one definition is equally
 * specific, the resolver fails with `reason: 'ambiguous'` and returns the
 * conflicting candidates so a caller can surface them to an admin.
 */
export function resolveShiftDefinition(
  input: ResolveInput,
  definitions: ShiftDefinitionRow[]
): ResolveResult {
  const { shiftType, date, personCountry, teamId } = input;
  const dayOfWeek = getDayOfWeek(date);
  const country = normalizeCountryCode(personCountry);

  const pool = definitions.filter((d) => d.shift_type === shiftType);

  const tiers: Array<{
    name: ResolveResult extends { ok: true } ? never : never;
    tier: Extract<ResolveResult, { ok: true }>["matchedTier"];
    filter: (d: ShiftDefinitionRow) => boolean;
  }> = [
    {
      tier: "team_country_day",
      filter: (d) =>
        defMatchesTeam(d, teamId) &&
        matchesCountryCode(country, d.country_codes) &&
        defMatchesDay(d, dayOfWeek),
    } as any,
    {
      tier: "team_country",
      filter: (d) =>
        defMatchesTeam(d, teamId) &&
        matchesCountryCode(country, d.country_codes) &&
        defHasNoDay(d),
    } as any,
    {
      tier: "country_day",
      filter: (d) =>
        defHasNoTeam(d) &&
        matchesCountryCode(country, d.country_codes) &&
        defMatchesDay(d, dayOfWeek),
    } as any,
    {
      tier: "country",
      filter: (d) =>
        defHasNoTeam(d) &&
        matchesCountryCode(country, d.country_codes) &&
        defHasNoDay(d),
    } as any,
    {
      tier: "global",
      filter: (d) => defHasNoTeam(d) && defHasNoCountry(d) && defHasNoDay(d),
    } as any,
  ];

  for (const t of tiers) {
    const matches = pool.filter(t.filter);
    if (matches.length === 1) {
      return { ok: true, definition: matches[0], matchedTier: t.tier };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        reason: "ambiguous",
        message: `Ambiguous shift definition: ${matches.length} rules match tier "${t.tier}" for shiftType=${shiftType} country=${country ?? "?"} team=${teamId ?? "?"} dow=${dayOfWeek}`,
        candidates: matches,
      };
    }
  }

  return {
    ok: false,
    reason: "no_match",
    message: `No shift definition matches shiftType=${shiftType} country=${country ?? "?"} team=${teamId ?? "?"} dow=${dayOfWeek}`,
    candidates: [],
  };
}