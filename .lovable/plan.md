## Plan: Vacation Carryover Days

Allow each employee to record how many vacation days they carried over from the previous year. The carryover is added to their yearly allowance, so `remaining = (allowance + carryover) − used`.

### Data model

Reuse the existing `user_time_allowances` table (already keyed by `user_id` + `year`). Add one column:

- `vacation_days_carryover INTEGER NOT NULL DEFAULT 0` — days brought in from the previous year for that `year` row.

Add an RLS policy so users can manage their **own** carryover for their own row (users can already view it). Managers/admins/planners retain their existing manage rights.

```text
user_time_allowances
├── user_id, year                (existing PK)
├── vacation_days_allowance      (existing — annual entitlement)
├── vacation_days_carryover      (NEW — user-editable)
└── flextime_hours_allowance     (existing)
```

### Backend changes

1. **Migration** — add the column + a policy `"Users manage own carryover"` that allows `INSERT`/`UPDATE` on their own row, but only touching `vacation_days_carryover` is enforced via the UI (RLS-wise the user can only write their own row; managers continue to control the allowance/override).
2. **Update `get_user_time_stats` RPC** to:
   - Read `vacation_days_carryover` (default 0).
   - Return `vacation_days_carryover` and adjust `vacation_days_remaining = allowance + carryover − used`.
3. **Update `reset_annual_allowances`** so the carryover does **not** copy forward automatically (each year's carryover is set fresh by the employee).

### Frontend changes

1. **`useUserTimeStats`**
   - Add `vacation_days_carryover` to `UserTimeStats`.
   - Add `updateCarryover(userId, days)` that upserts only the carryover field (does not flip `is_override`).

2. **`UserTimeStatsDisplay`**
   - In the Vacation Days tile, show `remaining/(allowance + carryover)` and a small "+N carried over" sub-line when carryover > 0.
   - Add a small "Edit carryover" link/button visible to the **viewing user themselves** (independent of `canEdit`, which currently gates the manager-level allowance editor). Opens a tiny dialog with one number input (0–60 days) and a Save button.
   - Keep the existing "Edit Allowances" manager dialog as-is, but add a third field there for carryover so managers can correct it too.

3. **Profile / Settings entry point** — add the same "Vacation carryover for {year}" input on the user's profile/settings page so they can set it without opening a schedule view. (Reuses the same `updateCarryover` call.)

### Out of scope

- Auto-calculating carryover from prior-year unused days.
- Carryover expiry rules / country-specific caps (can be a follow-up like the flextime carryover limit).
- Historical retro-edits to closed years.

### Files to touch

- `supabase/migrations/<new>.sql` — add column, update RPC, update reset function, add user-self RLS policy.
- `src/hooks/useUserTimeStats.ts` — extend type + add `updateCarryover`.
- `src/components/schedule/UserTimeStatsDisplay.tsx` — display + self-edit dialog + manager field.
- `src/pages/Profile.tsx` (or equivalent settings page) — small carryover input section. (Will confirm exact file during implementation.)
