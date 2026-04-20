

## Plan: Re-verify Partnership Scheduler After Fixes

### What I'll verify
1. **Migration applied**: `UK`→`GB` normalization done; stale weekend `shift_time_definition_id`s cleared; invalid weekday-weekend entries downgraded.
2. **Country-correct shift times**: Sample members across countries (DE, FI, GB, US) → resolved times match their country's definition.
3. **Holiday auto-detection**: A weekday that is a public holiday for a member's country → entry uses `weekend` shift_type with weekend times (no stale ID).
4. **Weekend guard**: No `weekend` shifts on Mon–Fri non-holiday dates remain.
5. **Coverage panel**: Renders in `PartnershipRotationManager`, flags US gaps (no early/late/weekend defs).
6. **UI drift indicator**: `SchedulerCellWithTooltip` shows warning when stored ID ≠ resolved ID.

### Approach (READ-ONLY)
- **SQL via supabase--read_query**:
  - Confirm no `country_codes` array still contains `'UK'` in `shift_time_definitions`.
  - Find any remaining `schedule_entries` with `shift_type='weekend'` on a weekday that is NOT a holiday for the user's country.
  - Find `shift_type='weekend'` entries whose `shift_time_definition_id` points to a non-weekend def (should be 0).
  - Sample 5 partnership members per distinct country; for each, pick one weekday and one known holiday → expected resolved def + times.
- **Code spot-check**: confirm `rosterGenerationUtils.ts` `buildEntry` matches the plan; confirm `SchedulerCellWithTooltip` re-resolves and surfaces drift; confirm `ShiftCoveragePanel` mounts in `PartnershipRotationManager`.
- **Browser walkthrough** (only if SQL passes): open `/schedule` partnership view, hover 3 cells across countries, check tooltip times + drift icons; open `Manage Partnerships` and confirm `ShiftCoveragePanel` renders.

### Report
- Markdown table per check: PASS / FAIL with row counts and example rows.
- Per-country sample trace: expected vs actual `{shift_type, start, end, def_id}`.
- If any FAIL, list the exact rows so a follow-up fix plan can target them.

### Out of scope
- Adding US shift definitions (admin data task).
- Any code/data changes — verification only.

