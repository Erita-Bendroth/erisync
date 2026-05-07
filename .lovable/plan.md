## Findings

**1. "German FlexTime Regulations" text** — In `FlexTimeSettingsDialog.tsx`, the Alert at the bottom is hardcoded and shown to every user regardless of their country.

**2. "One-time setting" claim** — The dialog *labels* the Starting Balance as "(one-time setting)", but the underlying logic in `useTimeEntries.ts` → `saveFlexTimeSettings` simply runs an `UPDATE` on `profiles.initial_flextime_balance` every time. **There is no enforcement** — a user can re-edit it as often as they want. The label is misleading rather than restrictive.

So today: any user can change their starting balance repeatedly, and changing it triggers a full recalculation of all monthly summaries (`recalculateAllMonthlySummaries`). This is risky because users could retroactively inflate their balance.

## Plan

### A. Country-gate the German regulations text
- Read the current user's `country_code` (already available via `useCurrentUserContext`).
- Pass it into `FlexTimeSettingsDialog` as a prop (`countryCode`).
- Only render the "German FlexTime Regulations" Alert when `countryCode === 'DE'`.
- For other countries, show a generic short note ("Check your local work agreement for carryover and balance rules.").

### B. Make Starting Balance a true one-time setting (with manager override)

**Logic change (frontend gating, no schema change required):**
- Treat the starting balance as "locked" once it has ever been set by the user. We detect this by checking whether `initial_flextime_balance` is non-null on the profile (today it defaults to 0, so we need a small distinction — see Technical section).
- In `FlexTimeSettingsDialog`:
  - If locked **and** the viewer is the profile owner (not a manager-edit context): disable the Hours/Minutes inputs, show a clear warning banner: *"Your starting balance has already been set and can no longer be changed. Contact your manager if a correction is needed."*
  - The Carryover Limit field remains editable by the user.
- The Save handler will only send `initial_flextime_balance` when the field is editable, so accidental resaves can't overwrite it.

**Manager override:**
- Add a new "Edit FlexTime Settings" action available to managers/planners/admins on each team-member's profile/row in the team management view (where managers already edit user data).
- Reuse `FlexTimeSettingsDialog` with a new `mode="manager"` prop:
  - Inputs are always editable (overrides the lock).
  - Warning banner shown: *"Manager override — changes will recalculate this user's full flextime history."*
  - Save path writes to the target user's `profiles.initial_flextime_balance` and `flextime_carryover_limit`, then triggers the same recalculation for that user.
- Permission check: only roles that already pass the existing manager hierarchy check (admin, planner, manager of that user's team) can open this dialog and call the save path. Reuse existing helpers from `teamHierarchyUtils` / role checks.

### C. UX warning copy (always visible to user-mode dialog)
Add a short note under "Starting Balance" in the user-mode dialog: *"This is a one-time setting. Once saved, only a manager can adjust it."*

## Technical notes

- **Detecting "already set"**: `initial_flextime_balance` defaults to `0`, so we can't distinguish "never set" from "set to 0". Two options:
  1. Add a boolean `initial_flextime_balance_set` column to `profiles` (set to `true` on first user save), OR
  2. Add a `initial_flextime_balance_set_at timestamptz` column (nullable; set on first user save). Preferred — also useful for audit.
  Manager overrides do **not** clear or block this flag; they just write through.
- Files touched (frontend only, plus one tiny migration):
  - `src/components/schedule/FlexTimeSettingsDialog.tsx` — add `countryCode`, `mode` ('user' | 'manager'), `locked` props; gate Alert; disable inputs when locked in user mode; add warning copy.
  - `src/components/schedule/FlexTimeSummaryCard.tsx` — pass `countryCode`, `locked` derived from profile.
  - `src/hooks/useTimeEntries.ts` — expose `initialBalanceLocked` (based on the new flag); on first save set `initial_flextime_balance_set_at = now()`; refuse to update `initial_flextime_balance` when locked unless `manager: true` is passed.
  - New: a small entry point in the team-member management UI (e.g. `UserManagement.tsx` or `EditUserModal.tsx`) to open the dialog in manager mode for a chosen user, plus a manager-mode save path that targets that user's profile.
- One Supabase migration: add `initial_flextime_balance_set_at timestamptz` to `profiles`; backfill `now()` for any user whose `initial_flextime_balance` is non-zero so existing non-zero values are treated as locked.

## Out of scope
- No change to balance calculation math.
- No change to `flextime_carryover_limit` editability — users can still adjust it.