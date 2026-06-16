## Goal

1. Let managers send a "request coverage" broadcast to every team member when a shift gap is detected. Members get an in-app notification + email and can claim the open shift; first claim auto-assigns the schedule entry.
2. In the Team Availability view for offshore partnership teams (Turbine Troubleshooting Offshore and any other partnership flagged offshore), show the actual shift code (E / L / N) on offshore-pattern days, "Available" on normal working days, and "N/A" on all other days.

---

## Part 1 — Open shift coverage requests

### 1.1 Database (new migration)

New table `open_shift_requests`:

```text
id uuid pk
team_id uuid not null            -- which team needs coverage
shift_date date not null
shift_type text not null         -- 'early' | 'late' | 'night' | other code
required int not null default 1
status text not null             -- 'open' | 'claimed' | 'cancelled'
claimed_by uuid                  -- profile id of the member who took it
claimed_at timestamptz
created_by uuid not null         -- manager who broadcast it
created_at timestamptz default now()
notes text
```

- Standard GRANTs: SELECT/INSERT/UPDATE for `authenticated`, ALL for `service_role`.
- RLS:
  - SELECT: any team member of `team_id` (existing membership pattern).
  - INSERT: only managers of `team_id` (or admin/planner).
  - UPDATE: managers OR a team member claiming an `open` row (status -> 'claimed', claimed_by = auth.uid()). Use a trigger or row check to prevent claiming a non-open row (concurrency safety).
- Trigger `claim_open_shift_request` (SECURITY DEFINER): when status transitions `open -> claimed`, create the corresponding `schedule_entries` row for `claimed_by` on `shift_date` with `shift_type` and `availability_status='available'`. If insert collides with an existing entry, fall back to UPDATE.

### 1.2 Edge function `request-shift-coverage`

Inputs: `team_id`, `shift_date`, `shift_type`, optional `notes`.

Steps:
1. Verify caller's JWT and that they manage `team_id` (`team_members.is_manager` or admin/planner).
2. Upsert one `open_shift_requests` row (one open row per team/date/shift to avoid duplicates).
3. Fetch all `team_members.user_id` for `team_id`, join `profiles` for name/email.
4. For each member (skip the manager themselves):
   - Insert a `notifications` row (type `coverage_request`, payload includes request id, date, shift code).
   - `supabase.functions.invoke('send-transactional-email', { templateName: 'shift-coverage-request', recipientEmail, templateData, idempotencyKey: \`coverage-${request.id}-${userId}\` })`.

Email template `shift-coverage-request.tsx` (React Email): site name, date, shift code (E/L/N), "Take this shift" CTA linking to `/schedule?openRequest=<id>`. Subject: `Coverage needed: <Shift> on <Date>`.

If app emails are not yet scaffolded, the build step calls `email_domain--scaffold_transactional_email` first; if no email domain, surface the standard setup dialog.

### 1.3 UI — Manager side

`OffshoreCoverageBanner.tsx` and `RosterValidationPanel.tsx`:

- When expanded, render a small "Request coverage" button next to each gap row. Manager-only (gate on roles + team manager check from existing `useCurrentUserContext`).
- Click -> confirm dialog -> invoke `request-shift-coverage` edge function -> toast "Request sent to N team members".
- Button disabled (label "Request sent") if an `open_shift_requests` row already exists for that team+date+shift.

### 1.4 UI — Member side

- New hook `useOpenShiftRequests(teamIds)` fetching `open_shift_requests` where `status='open'` and `team_id in (...)`, plus realtime subscription.
- New panel `OpenShiftRequestsPanel.tsx` shown on Schedule page above TeamAvailabilityView when the current user has open requests in their teams. Each card shows date + shift code + "Take shift" button.
- Take shift -> update row status to `claimed` (trigger inserts schedule entry). Toast success, refresh schedule + availability.
- Notification bell already exists; `coverage_request` notifications deep-link to `/schedule?openRequest=<id>` and the panel auto-scrolls/highlights that card.

### 1.5 Concurrency

The claim UPDATE uses a guarded WHERE clause:
```sql
UPDATE open_shift_requests
SET status='claimed', claimed_by=auth.uid(), claimed_at=now()
WHERE id=$1 AND status='open';
```
If 0 rows affected -> show "Already claimed by someone else" toast and refetch.

---

## Part 2 — Offshore E/L/N in Team Availability view

### 2.1 Detect offshore partnership teams

Reuse the existing offshore flag (`partnership_rotation_rosters.pattern_type` or whatever `isOffshore` already keys off in `useOffshoreScheduleCoverage`). Add a small helper `useOffshoreTeams(teamIds)` returning the subset of `teamIds` that belong to an offshore partnership.

### 2.2 Update `TeamAvailabilityView.tsx`

For each (user, day) cell:

- If the user's team for that day is **not** an offshore team -> keep current behaviour (CheckCircle2 + "Available" / XCircle + "Unavailable").
- If the user's team **is** an offshore team:
  - If a schedule entry exists with `shift_type` in `early|late|night` -> show a coloured badge `E`, `L`, or `N` (reuse existing offshore badge styling from `OffshorePatternPanel`) plus the green check.
  - Else if `availability_status='available'` and `activity_type='work'` (normal office day) -> CheckCircle2 + "Available".
  - Else (no entry, vacation, holiday, training, hotline, etc.) -> grey muted "N/A" pill.

This keeps the existing legend/components and only adds shift code rendering for offshore rows.

### 2.3 No database changes for Part 2.

---

## Technical summary

**New files**
- `supabase/migrations/<ts>_open_shift_requests.sql` — table, GRANTs, RLS, claim trigger.
- `supabase/functions/request-shift-coverage/index.ts` — broadcast endpoint.
- `supabase/functions/_shared/transactional-email-templates/shift-coverage-request.tsx` — React Email template + registry update.
- `src/hooks/useOpenShiftRequests.ts` — list/claim hook with realtime.
- `src/components/schedule/OpenShiftRequestsPanel.tsx` — member-facing claim UI.

**Edited files**
- `src/components/schedule/OffshoreCoverageBanner.tsx` — per-gap "Request coverage" button.
- `src/components/schedule/partnerships/RosterValidationPanel.tsx` — same per-gap button on the rotation roster.
- `src/components/schedule/TeamAvailabilityView.tsx` — render E/L/N badges + N/A for offshore teams.
- `src/components/schedule/ScheduleView.tsx` — mount `OpenShiftRequestsPanel`.
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template.

**Prerequisite tools to run before code edits**
- `email_domain--check_email_domain_status` — confirm domain.
- If app emails are not scaffolded: `email_domain--scaffold_transactional_email`, then deploy.

**Out of scope**
- Auto-send (deferred; manager click only per your choice).
- Manager approval flow for claims (auto-assign per your choice).
- Coverage requests for non-offshore teams (same component works, but only surfaced on the offshore banner and the rotation roster validation panel for now).
