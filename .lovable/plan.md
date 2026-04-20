

## Plan: Deterministic Shift Rule Resolution + Coverage Report

### Discovery
- `src/lib/shiftTimeUtils.ts` already does priority-based resolution (7 tiers) but:
  - Returns silently on no match (default fallback) — no validation error path
  - Doesn't detect ambiguity (multiple equally-specific rules)
  - Returns only `{startTime, endTime}` strings — no timezone-aware DateTime
  - No country→timezone mapping
  - No DST-aware instance builder
- `src/lib/countryCodeUtils.ts` normalizes country codes (UK→GB) — reuse it
- No country→IANA timezone map exists
- No test harness for shift resolution (only `rosterWorkflow.test.ts`)

### Approach

**1. New `src/lib/shiftResolver.ts`** — strict resolver wrapping existing logic
- `resolveShiftDefinition({ shiftType, date, personCountry, teamId })` returns:
  - `{ ok: true, definition, matchedTier }` or
  - `{ ok: false, reason: 'no_match' | 'ambiguous', candidates }`
- Priority (simplified per task spec):
  1. team + country (+ optional day match)
  2. country only
  3. global fallback (no team, no country)
  4. error
- Ambiguity check: within the winning tier, if >1 row has identical specificity → fail with conflict list

**2. New `src/lib/timezoneUtils.ts`** — country→IANA timezone map
- Covers all countries already in `countryCodeUtils.ts` (AT, BE, CH, DE, DK, ES, FI, FR, GB, IE, IT, NL, NO, PL, PT, SE)
- `getTimezoneForCountry(code): string`

**3. New `src/lib/shiftInstance.ts`** — DST-safe builder
- `buildShiftInstance(definition, date, timezone)` using `date-fns-tz`:
  - Parses `start_time`/`end_time` as wall-clock in `timezone`
  - Detects midnight crossing (`end <= start` → end on next day)
  - Returns `{ startUtc, endUtc, startLocal, endLocal, durationMinutes, timezone, crossesMidnight, dstTransition }`
- Duration computed from UTC instants (correctly accounts for DST gaps/overlaps)

**4. Test suite `src/lib/shiftResolver.test.ts`** (Vitest, deterministic, no DB)
- In-memory definition fixtures mirroring UI table
- Scenarios:
  1. Same shiftType, NO/DE/PL → different end times resolve correctly
  2. Team override wins over country-only rule
  3. DST week (last Sun March / last Sun October Europe) → 8h shift stays 8h local; UTC duration shifts by 1h on transition day as expected
  4. No matching rule → `{ ok: false, reason: 'no_match' }`
  5. Two equally-specific rules for same country/team/day → `{ ok: false, reason: 'ambiguous', candidates: [...] }`
  6. Calendar preview helper returns local times per member country

**5. Coverage Report generator `src/lib/shiftCoverageReport.ts`**
- `generateCoverageReport(definitions, countries, shiftTypes)` → matrix of `{ country, shiftType, rule | 'MISSING' | 'AMBIGUOUS' }`
- Exposed via small admin-only script `scripts/shift-coverage-report.ts` that pulls live definitions from Supabase and prints markdown table

**6. Wire resolver into one hot path (non-breaking)**
- Update `getApplicableShiftTimes` in `shiftTimeUtils.ts` to optionally delegate to new resolver behind a `strict?: boolean` flag — default `false` to preserve current behavior
- Add `resolveShiftDefinitionStrict` export for callers that want hard errors (roster generation, bulk scheduling preview)

### Files

New
- `src/lib/shiftResolver.ts`
- `src/lib/shiftResolver.test.ts`
- `src/lib/timezoneUtils.ts`
- `src/lib/shiftInstance.ts`
- `src/lib/shiftInstance.test.ts`
- `src/lib/shiftCoverageReport.ts`
- `scripts/shift-coverage-report.ts`

Edit
- `src/lib/shiftTimeUtils.ts` (add optional strict delegation, no behavior change by default)
- `package.json` (add `date-fns-tz` if missing; add `report:shifts` script)

### Out of scope
- UI changes to surface ambiguity warnings (follow-up)
- Migrating existing callers to strict mode (follow-up after report shows clean coverage)
- Storing timezone on shift definitions (current model: derive from person's country)

### Deliverables on completion
- `npm test` runs new suites with PASS/FAIL per scenario, printing expected vs actual start/end/duration on failure
- `npm run report:shifts` prints a Shift Rule Coverage Report (country × shiftType matrix)

