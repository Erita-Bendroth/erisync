// Lightweight test suite for shiftResolver.
// Uses local globals to avoid requiring @types/vitest at build time.
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
};
import { resolveShiftDefinition, type ShiftDefinitionRow, type ResolveResult } from "./shiftResolver";

const def = (overrides: Partial<ShiftDefinitionRow>): ShiftDefinitionRow => ({
  id: Math.random().toString(36).slice(2),
  shift_type: "early",
  team_id: null,
  team_ids: null,
  country_codes: null,
  day_of_week: null,
  start_time: "06:00",
  end_time: "14:00",
  description: null,
  ...overrides,
});

// 2025-01-08 = Wednesday (UTC dow=3)
const wed = new Date("2025-01-08T00:00:00Z");

describe("resolveShiftDefinition", () => {
  it("scenario 1: same shiftType, different countries → distinct rules", () => {
    const defs = [
      def({ id: "no-early", country_codes: ["NO"], end_time: "14:00", description: "NO early" }),
      def({ id: "de-early", country_codes: ["DE"], end_time: "14:30", description: "DE early" }),
      def({ id: "pl-early", country_codes: ["PL"], end_time: "15:00", description: "PL early" }),
    ];
    const no = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "NO" }, defs);
    const de = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "DE" }, defs);
    const pl = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "PL" }, defs);
    expect(no.ok && no.definition.id).toBe("no-early");
    expect(de.ok && de.definition.id).toBe("de-early");
    expect(pl.ok && pl.definition.id).toBe("pl-early");
  });

  it("scenario 2: team override beats country-only rule", () => {
    const defs = [
      def({ id: "de-country", country_codes: ["DE"], end_time: "14:30" }),
      def({ id: "team-de", team_id: "team-1", country_codes: ["DE"], end_time: "13:00" }),
    ];
    const r = resolveShiftDefinition(
      { shiftType: "early", date: wed, personCountry: "DE", teamId: "team-1" },
      defs
    );
    expect(r.ok && r.definition.id).toBe("team-de");
    expect(r.ok && r.matchedTier).toBe("team_country");
  });

  it("scenario 4: no matching rule → no_match", () => {
    const defs = [def({ id: "de", country_codes: ["DE"] })];
    const r: ResolveResult = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "FR" }, defs);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("no_match");
  });

  it("scenario 5: equally specific rules → ambiguous with candidates", () => {
    const defs = [
      def({ id: "a", country_codes: ["DE"], end_time: "14:00" }),
      def({ id: "b", country_codes: ["DE"], end_time: "15:00" }),
    ];
    const r: ResolveResult = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "DE" }, defs);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toBe("ambiguous");
      expect(r.candidates.map((c) => c.id).sort()).toEqual(["a", "b"]);
    }
  });

  it("global fallback applies when no country/team-specific rule exists", () => {
    const defs = [def({ id: "global", end_time: "14:00" })];
    const r = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "FR" }, defs);
    expect(r.ok && r.matchedTier).toBe("global");
  });

  it("country+day rule wins over country-only rule on matching day", () => {
    const defs = [
      def({ id: "de-any", country_codes: ["DE"], end_time: "14:00" }),
      def({ id: "de-wed", country_codes: ["DE"], day_of_week: [3], end_time: "13:00" }),
    ];
    const r = resolveShiftDefinition({ shiftType: "early", date: wed, personCountry: "DE" }, defs);
    expect(r.ok && r.definition.id).toBe("de-wed");
    expect(r.ok && r.matchedTier).toBe("country_day");
  });
});