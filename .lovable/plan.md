
## Goal

Support an offshore-style continuous shift pattern (E / L / N / Day / WO) in partnership rotation rosters, where each shift code carries its own mandatory recovery rule (e.g. Night = 1 work + 2 WO, Early = 1 work + 1 WO). The roster builder auto-generates WO days from the rule, and partnerships can opt in/out of this mode.

## Approach overview

Introduce a "Shift Pattern Library" scoped per partnership. Each shift code defines:
- Letter / label / color
- Working or non-working (WO = non-working)
- Recovery rule: how many WO days must follow one shift of this type

Partnerships gain an `offshore_mode` toggle. When ON, the roster builder switches from week-grid input to a day-by-day continuous planner that:
1. Accepts a starting anchor shift per person (e.g. AAMPO starts Night on 15/Mar)
2. Auto-fills the following days with WO recovery based on the shift's rule
3. Optionally repeats the micro-cycle for the roster horizon
4. Allows manual overrides per day with validation against the recovery rule

## Data model (new tables / columns)

```text
partnership_shift_codes
  id, partnership_id, code (E|L|N|D|WO|custom),
  label, color, is_working (bool),
  recovery_days_after (int default 0),
  default_shift_time_definition_id (nullable -> existing per-country times),
  sort_order

partnership_rotation_rosters
  + offshore_mode (bool default false)
  + cycle_length_days (int nullable) -- optional repeat length

roster_day_assignments  (NEW, day-grain alternative to week grid)
  id, roster_id, user_id, work_date,
  shift_code_id (nullable -> WO if null & flagged),
  is_recovery (bool), is_anchor (bool),
  generated_by (manual|auto-recovery|cycle-repeat)
```

Keep existing `roster_week_assignments` for non-offshore rosters; offshore rosters use `roster_day_assignments` instead. Activation writes both modes into `schedule_entries` (WO = non-working entry / unavailability marker, configurable).

## UI changes

- **Partnership settings**: new "Shift Pattern" tab to define codes + recovery rules. Seed with offshore preset (E/L/N/D/WO with rules from the screenshot).
- **Roster builder** (`RosterBuilderDialog`): if `offshore_mode`, swap `RosterWeekGrid` for a new `RosterDayPatternGrid`:
  - Rows = members, columns = dates across the roster window
  - Click a cell to assign a shift code; auto-paints following WO cells per recovery rule
  - Color-coded chips matching the screenshot (E green, L yellow, N blue, WO red)
  - "Repeat cycle" button to project the micro-pattern across remaining dates
- **Validation panel**: enforce recovery rule (warn if next N days aren't WO), enforce min staffing per working shift, flag consecutive work-day overruns.
- **Calendar preview**: render the offshore codes inline.

## Activation / enforcement

- On activation: insert `schedule_entries` for working days using the linked shift time definition (country priority rules still apply); WO days written as a non-working entry tagged "Recovery (WO)" so the existing Leave Precedence + display standards treat them as unavailability.
- WO days block work assignment elsewhere (hard block via existing schedule write paths).

## Out of scope

- Crew rotation optimization / auto-balancing across multiple people
- Payroll/flextime impact of WO days (reuse existing flextime rules)
- Migration of historical rosters to the new model

## Technical details

- Migration adds the two tables + columns with GRANTs for `authenticated` (RLS scoped to partnership membership via existing helper) + `service_role`, plus an enum-free `code` text column with per-partnership uniqueness.
- New hook `usePartnershipShiftCodes(partnershipId)` for CRUD + caching.
- New hook `useOffshoreRosterBuilder` encapsulating recovery-rule auto-fill and cycle repetition.
- Extend `useRosterValidation` with `validateRecoveryRule(assignments, codes)`.
- Extend roster activation edge logic to branch on `offshore_mode` and write day-level entries.
- Reuse `shiftResolver` to pick the country-specific time for E/L/N/D.

## Open questions to confirm before build

1. Should WO days appear in the schedule as "Recovery Day" unavailability, or just as empty (no entry)? Recommendation: explicit "Recovery (WO)" entry so it blocks swaps and shows in coverage views.
2. Recovery rule semantics — fixed count (Night → exactly 2 WO) or minimum (Night → ≥2 WO)? Recommendation: minimum, with a warning if exceeded by > X.
3. Should the offshore preset be seeded automatically for every new partnership, or only when the toggle is flipped on? Recommendation: seed on toggle-on.
