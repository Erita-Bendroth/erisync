## Goals

1. **Only the user's own time entries affect the flex balance.** Schedule entries created by managers/planners (e.g. "Normal shift 08:00–16:30" assigned by a manager) must NEVER auto-create a `daily_time_entry` or change the flex delta. Flex is added/deducted ONLY when the employee themselves enters/edits their actual working hours via the time-tracking UI.
2. **Short workdays don't go negative.** When the user records a shorter day, delta is clamped at 0. Only explicit `fza_withdrawal` entries can produce a negative delta.
3. **Flextime report.** Users can download their own yearly or monthly flextime report from their profile. Admins/Planners can pick any user and download the same report.
4. **Fix "Scheduled by: Unknown"** in the Edit Schedule modal.

## Plan

### 1. Stop schedule entries from touching flex balance

- **`src/hooks/useTimeEntries.ts`** — keep the existing one-way sync **time entry → schedule entry** (so managers can see availability), but the reverse path must not exist.
- Audit and remove any code path that writes to `daily_time_entries` when a `schedule_entries` row is created/updated by someone other than the user themselves. Verified currently only `useTimeEntries.saveEntry` writes to `daily_time_entries`, and it's always `user.id` driven — good. We will add an explicit guard: any write to `daily_time_entries` requires `auth.uid() === user_id` (already enforced by RLS).
- **`src/lib/flexTimeUtils.ts`** — clamp `flexDelta` to `>= 0` for any `entryType !== 'fza_withdrawal'`. Earning extra still adds; finishing early yields 0 instead of negative.

### 2. Data correction for AMT

Migration that:
- Sets `flextime_delta = 0` on AMT's 4 short-workday rows (`2026-01-16`, `2026-02-27`, `2026-03-27`, `2026-04-30`).
- Recomputes `monthly_flextime_summary` for AMT so the displayed balance reflects only initial balance + earned + explicit FZA withdrawals.

### 3. Flextime report (download)

**New component:** `src/components/profile/FlextimeReportDialog.tsx`
- Period selector: "Whole year" or "Specific month" + year/month dropdowns.
- Pulls the user's `daily_time_entries` for the period and renders a table:
  Date | Day | Type | Start | End | Break | Actual | Target | Flex Delta | FZA Hours | Comment
- Footer totals row: total earned (positive deltas), total FZA withdrawn, total short-day deltas (now 0), net change, starting balance for period, ending balance.
- Download buttons: **CSV** and **PDF** (jsPDF + autotable, already used in the project). File name: `flextime-{user-initials}-{period}.csv|pdf`.

**Integration points:**
- `src/pages/Profile.tsx` (or equivalent) — add a "Flextime report" button in the user's profile that opens the dialog for the current user.
- `src/pages/Admin*` user-detail view — add a "Flextime report" button on each user's detail page (visible only to `admin` / `planner`) that opens the same dialog targeted at that user.
- A small `useFlextimeReport(userId, range)` hook that fetches entries + monthly summaries via existing RLS (admins/planners already have read access to other users' entries).

### 4. Fix "Scheduled by: Unknown"

- New SECURITY DEFINER RPC `public.get_user_display_names(_user_ids uuid[])` returning `(user_id, display_name)`.
- `MultiTeamScheduleView.tsx` (~L422) and `ScheduleView.tsx` (~L1547): for any `created_by` UUID not present in the team-scoped `profileMap`, look it up via the new RPC and merge into a `creatorMap`. Replace `'Unknown'` fallback with `'System'`.

## Files to change / add

- `src/lib/flexTimeUtils.ts` — clamp non-FZA deltas at 0
- `src/components/profile/FlextimeReportDialog.tsx` — new dialog with table + CSV/PDF export
- `src/hooks/useFlextimeReport.ts` — new data hook
- `src/pages/Profile.tsx` — wire "Flextime report" button (self)
- Admin user detail page — wire "Flextime report" button (admin/planner)
- `src/components/schedule/MultiTeamScheduleView.tsx` + `ScheduleView.tsx` — creator-name RPC
- New migration:
  - `get_user_display_names()` SECURITY DEFINER function
  - Fix AMT's 4 short-day rows to delta 0
  - Recompute AMT's `monthly_flextime_summary`

## Out of scope / unchanged

- Friday 6h target stays.
- Existing 5 explicit FZA withdrawals (Jan 2 + Apr 7–10 = 36h) remain.
- Initial flex balance additive logic stays as already fixed.
- One-way sync from time entries → schedule entries (for visibility) stays.
