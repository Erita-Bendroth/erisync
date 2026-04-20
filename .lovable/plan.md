

## Plan: Verify Partnership Scheduler — Country-Specific Shift Times + Holiday Auto-Detection

### What I'll verify
1. **Country-specific shift times**: When a member from country X is assigned a shift type (e.g. "early"), the resolved start/end times match the shift definition row tagged for X — not a default/global row.
2. **Holiday auto-detection**: Public holidays for each member's country are detected and shifts are planned accordingly (skipped, swapped to weekend shift, or flagged).

### Approach (READ-ONLY verification — no code changes)

**Step 1 — Data inventory (SQL via supabase--read_query)**
- List all `shift_time_definitions` rows: `shift_type`, `team_id`, `team_ids`, `country_codes`, `day_of_week`, `start_time`, `end_time`.
- Run the new `generateCoverageReport` logic mentally against this matrix to flag any `MISSING` or `AMBIGUOUS` (country × shiftType) cells.
- List partnerships and their teams + members' countries to know which (country, shiftType) combos actually matter.
- List `holidays` rows for the next 90 days for the relevant countries.

**Step 2 — Resolver spot-checks (SQL + reading `shiftResolver.ts`)**
- For 3 representative members in different countries on the same partnership, simulate `resolveShiftDefinition` for `early`, `late`, `normal`, `weekend` on a normal weekday and a known public-holiday date. Confirm:
  - Each member resolves to their country's row (not a fallback).
  - On a public holiday, the schedule entry either uses the `weekend` shift definition or is skipped per `bulk-scheduler-skip-holiday-logic` memory.

**Step 3 — Live UI walkthrough (browser tools)**
- Navigate to `/schedule` → Partnership view (already loaded per your session).
- Open an existing partnership roster and inspect 2–3 cells across different country members:
  - Hover to read the tooltip times rendered by `SchedulerCellWithTooltip` (uses `getApplicableShiftTimes`).
  - Cross-check against the SQL-resolved expected times.
- Pick a known upcoming public holiday for one member's country and verify the cell on that date shows a holiday badge / weekend shift / skipped state.

**Step 4 — Report**
- Output a **Shift Rule Coverage Report**: country × shiftType → matched rule id (or MISSING / AMBIGUOUS).
- Output a **Per-Member Sample Trace**: for each sampled cell, expected vs actual `{start, end, shiftType, holidayHandling}`, with PASS / FAIL.
- If any FAIL or AMBIGUOUS rows surface, list the conflicting/missing definitions so they can be fixed in admin.

### Deliverables
- Markdown report posted in chat (no files written).
- Clear PASS/FAIL per scenario; if FAIL, the specific rule gap or mismatch.

### Out of scope
- Editing shift definitions, holidays, or any roster data.
- Changing resolver/UI code (only invoked if a defect is found — would be a follow-up plan).

