

## Plan: Fix Partnership Roster Generation — Country-Correct Times + Holiday Handling

### Root causes (from QA)
1. **Stale `shift_time_definition_id`**: holiday flip changes `shift_type` to `weekend` but keeps the original definition ID → UI shows weekend label with early/normal times.
2. **Country mismatch**: `rosterGenerationUtils.ts` resolves shift times using `member.country_code`, but resolver/data has `GB` vs `UK` aliasing gaps and some defs target wrong countries.
3. **Invalid weekend assignments on weekdays**: roster generator writes `weekend` shifts to Mon–Fri without validating against `weekend-shift-validation` rule.
4. **Coverage gaps (US)**: missing `early`/`late`/`weekend` defs → silent fallback.
5. **UI short-circuit**: `SchedulerCellWithTooltip` trusts stored `shift_time_definition_id` first, hiding stale-data bugs.

### Fixes

**A. Roster generator (`src/lib/rosterGenerationUtils.ts`)**
- Before persisting each entry, call `resolveShiftDefinition` (strict) with the member's normalized country.
- On holiday detection for that date+country: either (a) skip the entry, or (b) re-resolve with `shift_type='weekend'` and use the **resolved** weekend definition ID — never reuse the weekday ID.
- Validate weekend shifts only land on Sat/Sun OR a public holiday for that member's country; otherwise downgrade to `default_shift_for_non_duty` and log.
- On `no_match` / `ambiguous` from resolver: skip entry, push to a `generation_warnings` array returned to the UI.

**B. Country normalization**
- Make `rosterGenerationUtils` and `getApplicableShiftTimes` both call `normalizeCountryCode` before resolution (UK→GB).
- Add a one-shot SQL migration to normalize existing `shift_time_definitions.country_codes` (`UK` → `GB`).

**C. UI cell (`SchedulerCellWithTooltip.tsx`)**
- Stop trusting stored `shift_time_definition_id` blindly. Always re-resolve via `getApplicableShiftTimes` using `shiftType + country + team + date`. Use stored ID only as a tiebreaker when resolver returns ambiguous.
- Show a small warning icon in the cell tooltip when stored ID ≠ resolved ID (data drift indicator for managers).

**D. Backfill bad existing data**
- One-off SQL: for `schedule_entries` where `shift_type='weekend'` AND `shift_time_definition_id` points to a non-weekend def → set `shift_time_definition_id = NULL` so UI re-resolves correctly.
- One-off SQL: for `schedule_entries` where `shift_type='weekend'` on a weekday that is NOT a holiday for the member's country → flag (insert into a `roster_activity_log` cleanup entry) and set `shift_type` to roster's `default_shift_for_non_duty`.

**E. Coverage report surfacing**
- Add a "Shift Rule Coverage" panel in `PartnershipRotationManager` showing the country×shiftType matrix with MISSING/AMBIGUOUS cells highlighted, so admins can fix US gaps before generating.
- Block "Generate Schedules" button when the partnership's member countries have any MISSING cell.

**F. Tests**
- Extend `rosterWorkflow.test.ts` with cases:
  - GB member with UK-tagged def resolves correctly (alias).
  - Holiday on Tue for FI member → weekend def used, weekend times applied.
  - US member with no `early` def → generation blocked with clear error.
  - Weekend shift requested on a Wed (non-holiday) → downgraded.

### Files to change
- `src/lib/rosterGenerationUtils.ts` (resolver integration, holiday/weekend guards, warnings)
- `src/lib/shiftTimeUtils.ts` (force normalization, expose strict path)
- `src/components/schedule/unified/SchedulerCellWithTooltip.tsx` (re-resolve, drift indicator)
- `src/components/schedule/partnerships/PartnershipRotationManager.tsx` (coverage panel + gate button)
- `src/lib/rosterWorkflow.test.ts` (new cases)
- New migration: normalize `shift_time_definitions.country_codes` UK→GB
- New data cleanup SQL: fix stale weekend rows in `schedule_entries`

### Out of scope
- Adding US shift definitions (data task for admins via existing UI).
- Redesigning shift definition admin UI.
- Changing approval workflow.

### Deliverables
- After approval: code changes + migration + cleanup SQL run, then re-run the QA verification — all sampled cells PASS, coverage panel shows green for active partnerships.

