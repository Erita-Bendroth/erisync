

## Plan: Correct Partnership Approval Workflow for N Teams

### Discovery summary
- Roster lives in `partnership_rotation_rosters` with `status` (free text), `submitted_by`, `submitted_at`.
- Per-team approvals live in `roster_manager_approvals` (`approved` boolean, `team_id`, `manager_id`, `comments`).
- Activity log already exists in `roster_activity_log`.
- Submission is handled by edge function `create-roster-approvals` (auto-approves submitter).
- Activation logic lives in `src/lib/rosterGenerationUtils.ts` via `validateRosterApprovals` + `generateRosterSchedules`.
- Editing UI: `RosterBuilderDialog`, `RosterApprovalPanel`, `PartnershipRotationManager`.
- Current gaps:
  - `status` is free text; no enum, no `NeedsChanges`/`PartiallyApproved`.
  - No `roster_version` → editing after approval does not reset approvals.
  - No reject state on `roster_manager_approvals` (only boolean approved).
  - No DB-side guards; all rules live in TS and can be bypassed.
  - No deterministic test harness.

### State machine (Task 1)

Roster global states:
- `draft` → `submitted` (trigger: submit; guard: ≥1 assignment)
- `submitted` → `partially_approved` (trigger: first approve)
- `submitted` / `partially_approved` → `fully_approved` (trigger: last approve; guard: all teams approved, none rejected)
- `submitted` / `partially_approved` → `needs_changes` (trigger: any reject)
- `needs_changes` → `draft` (trigger: edit/resubmit cycle)
- `fully_approved` → `activated` (trigger: activate; guard: all approved + version unchanged)
- any non-`activated` → `draft` (trigger: roster edit; side effect: bump version, reset approvals)

Per-team approval states: `pending`, `approved`, `rejected` (replace boolean).

### Task 2: Invariants (DB + code)

Add a DB migration:
- `partnership_rotation_rosters.version int default 1`
- `partnership_rotation_rosters.status` constrained to enum values
- `roster_manager_approvals.state text` (`pending|approved|rejected`) + `roster_version int` snapshot
- Trigger `bump_roster_version_on_change` on `roster_week_assignments` insert/update/delete → increments `partnership_rotation_rosters.version`, resets all approvals for that roster to `pending`, sets status back to `draft`, writes audit row.
- Trigger `enforce_approval_guards` on `roster_manager_approvals` → reject approve when roster status not in (`submitted`,`partially_approved`,`needs_changes`); reject when `manager_id != auth.uid()` and caller not admin/planner; reject when `team_id` not in partnership.
- Trigger `recompute_roster_status` after approval change → set `partially_approved`, `fully_approved`, or `needs_changes`.
- RPC `activate_roster(roster_id)` that checks all approvals = `approved` and version matches snapshot before allowing activation.

Code guards in `src/lib/rosterWorkflow.ts` (new):
- `canSubmit(roster, assignments)`
- `canApprove(user, roster, team, approvals)`
- `canReject(user, roster, team)`
- `canActivate(roster, approvals)`
- `canEdit(user, roster, team)`
- `applyEditSideEffects(roster)` → bumps version, resets approvals locally for optimistic UI.

### Task 3: Deterministic test harness

Create `supabase/functions/test-roster-workflow/index.ts` (admin-only, dev guard) that:
- Seeds N synthetic teams + managers in a sandbox partnership (`is_test=true`).
- Runs scenarios 1–6 in-process against the real DB using service role:
  1. Happy path N∈{2,3,5}
  2. Approve-before-submit → expect guard failure
  3. Reject path → expect `needs_changes`, activation blocked
  4. Edit-after-approve → expect version bump + all approvals reset
  5. Unauthorized cross-team edit → expect 403
  6. Idempotent submit/approve → no duplicate rows, state stable
- After each action asserts all invariants and prints `PASS/FAIL: <invariant>`.
- Cleans up test partnership at end.

Also add a lightweight Vitest unit suite for pure guard functions in `src/lib/rosterWorkflow.test.ts` so guards are testable without DB.

### Audit log

Extend `roster_activity_log` usage to record:
- `submitted`, `approved`, `rejected`, `roster_changed_after_approval`, `activated`, `needs_changes_set`
- Include `roster_version`, `team_id`, actor.

### Files

New
- `supabase/migrations/<ts>_roster_workflow_state_machine.sql`
- `src/lib/rosterWorkflow.ts`
- `src/lib/rosterWorkflow.test.ts`
- `supabase/functions/test-roster-workflow/index.ts`

Edit
- `supabase/functions/create-roster-approvals/index.ts` (use new state + version)
- `src/lib/rosterGenerationUtils.ts` (use `activate_roster` RPC, version check)
- `src/components/schedule/partnerships/RosterApprovalPanel.tsx` (show 3-state, reject button, NeedsChanges banner)
- `src/components/schedule/partnerships/RosterBuilderDialog.tsx` (warn on edit-after-approval)
- `src/components/schedule/partnerships/PartnershipRotationManager.tsx` (gate Activate on `fully_approved`)
- `supabase/config.toml` (register `test-roster-workflow` with `verify_jwt = true`)

### Out of scope (will not change)
- Existing schedule generation logic
- UI redesign beyond state badges + reject button + version warning

