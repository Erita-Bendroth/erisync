# Fix: Initial FlexTime Balance not propagating

## Root cause

In `src/hooks/useTimeEntries.ts`, the profile field `initial_flextime_balance` is **only used when there is no previous monthly summary** (see line 121 and lines 386–395). It seeds month N's starting balance from month N-1's `ending_balance`, falling back to `initial_flextime_balance` only if the previous summary doesn't exist.

User AMT already has `monthly_flextime_summary` rows going back to 2025-12. When he set his initial balance to 15:15, the DB column updated correctly (verified: `initial_flextime_balance = 15.25`), but every existing monthly summary still chains off the old starting point. The currently displayed +8:00 comes from May 2026's stored `ending_balance`, not the new initial balance, so the UI appears unchanged.

`updateMonthlySummary()` only recomputes the current month, so it can't fix this either.

## Fix

When `saveFlexTimeSettings` updates `initial_flextime_balance`, recompute the entire chain of monthly summaries from the earliest summary forward, using the new initial balance as the very first month's `starting_balance`.

### Changes in `src/hooks/useTimeEntries.ts`

1. Add a new helper `recalculateAllMonthlySummaries(newInitialBalance)`:
   - Fetch all `monthly_flextime_summary` rows for the user, ordered by `(year, month)` ascending.
   - If none exist, do nothing (the existing fallback path will pick up the new initial balance for the current month).
   - For each month in order:
     - For the first month, `starting_balance = newInitialBalance`.
     - For subsequent months, `starting_balance = previous month's recomputed ending_balance`.
     - Recompute `month_delta` by summing `flextime_delta` from `daily_time_entries` for that month (don't trust the stored value — it may be stale if entries changed).
     - `ending_balance = starting_balance + month_delta`.
     - Upsert the row.

2. In `saveFlexTimeSettings` (around line 417), after the profile update succeeds:
   - Call `await recalculateAllMonthlySummaries(newInitialBalance)` instead of the current single-month `updateMonthlySummary()`.
   - Then `await fetchEntries()` so the UI re-reads fresh values.

3. Keep existing behavior for users who have no summaries yet (current fallback in lines 121 and 386–395 already handles this correctly).

## Files touched

- `src/hooks/useTimeEntries.ts` — add helper, wire it into `saveFlexTimeSettings`.

No DB migrations or schema changes. No UI changes — the dialog already passes the correct decimal value.

## Verification

After the fix, AMT setting 15h 15m should:
- Update profile `initial_flextime_balance` to 15.25 (already works).
- Recompute Dec 2025 starting from 15.25, then cascade through Jan, Feb, Mar, Apr, May, Jul, Aug 2026.
- The "Current Balance" card reflects the new May/current ending balance.