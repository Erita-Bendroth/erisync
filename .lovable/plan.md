# Fix: Managers can't update vacation day allowances

## Root cause (confirmed)

`updateAllowance` in `src/hooks/useUserTimeStats.ts` calls:

```ts
.from('user_time_allowances').upsert({ ... })
```

**without** `onConflict: 'user_id,year'`. Supabase/PostgREST then only conflicts on the primary key (`id`), which is a fresh random UUID — so every save is effectively an INSERT. The table has a unique constraint on `(user_id, year)` (`user_time_allowances_user_id_year_key`, verified in the DB). Result: the first edit for a user/year succeeds; every edit after that fails with a unique-violation error and the UI shows "Failed to update allowances". This matches exactly what you're seeing.

(`updateCarryover` already uses the correct `onConflict`, which is why carryover edits still work.)

## Changes

1. **`src/hooks/useUserTimeStats.ts` — `updateAllowance`:**
   - Add `{ onConflict: 'user_id,year' }` to the upsert so it updates the existing row instead of inserting.
   - Preserve `vacation_days_carryover` (fetch existing row first, like `updateCarryover` does) so editing the allowance never wipes a configured carryover.
   - Keep `is_override: true` and `set_by` behavior unchanged.

2. No database migration needed — RLS policies already allow managers to manage allowances for members of their teams (verified).

## Verification

- Edit a user's vacation days twice in a row as a manager (both saves succeed).
- Confirm carryover days are preserved after an allowance edit.
- Check the "Custom" badge / remaining-days recalculation still update after save.
