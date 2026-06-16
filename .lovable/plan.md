## Problem

Turbine Troubleshooting Offshore already has two managers in the database (ERBET and MAONI, both `is_manager = true`). The system grants equal rights to every `is_manager = true` row everywhere — the gap is only in the **roster approval flow**, which is why you (MAONI) see nothing to approve.

Two concrete bugs:

1. **Missing-approvals fallback collapses to one manager per team.** `RosterApprovalPanel.tsx` (lines 202-214) uses `teamManagers.find(tm => tm.team_id === team.id)` when listing teams that have no approval record yet. `.find()` returns only the first manager, so the second manager (MAONI) is invisible and never gets a record created.

2. **No backfill when a manager is added after submission.** The roster was submitted while only ERBET existed (or the auto-submitter was ERBET), so only ERBET's row exists in `roster_manager_approvals`. MAONI has no record → the panel shows nothing to approve for her. The edge function `create-roster-approvals` already loops over all managers correctly, but it only runs once at submission time.

## Plan

### 1. Fix the missing-approvals fan-out (`RosterApprovalPanel.tsx`)
Replace the `.find()` collapse with a flat-map that yields one `MissingApproval` per `(team, manager)` pair. Update the `MissingApproval` type to drop the implicit "one manager per team" assumption. The existing "Create approval records" admin button already inserts `recordsToCreate` as-is, so it will create both rows automatically once they are listed.

### 2. Auto-detect managers added after submission
On every load of the approval panel, for rosters in `pending_approval` / `needs_changes` state, compare:
- managers currently in `team_members` with `is_manager = true` for the roster's teams, against
- managers who already have a `roster_manager_approvals` row for this `roster_id` + `roster_version`.

Any manager in the first set but not the second becomes a missing approval row, regardless of whether the team already has approvals from other managers. This naturally surfaces MAONI alongside ERBET's existing approval and lets either an admin or any team manager click "Create approval records" to backfill.

### 3. Let any team manager (not just admins) backfill missing records
Currently the "Create approval records" button is gated on `isAdmin`. Loosen it so any user who is a manager of at least one of the listed missing teams can also trigger the backfill for those teams. Keeps admin/planner override; adds manager self-service so MAONI can add her own row without waiting for an admin.

### 4. Confirm RLS already allows the second manager to act
`roster_manager_approvals` policies key off `manager_id = auth.uid()` (already in place from the original approval feature). No migration needed — once MAONI's row exists, she sees Approve / Request Changes buttons identical to ERBET's.

### 5. No changes needed to edit rights
Every roster/schedule write path in the codebase already checks `is_manager = true` on `team_members` without limiting to a single manager, so MAONI already has full edit rights on the roster grid, shift palette, pattern editor, shadow pairs, etc. This plan does not touch those paths.

## Files to change

- `src/components/schedule/partnerships/RosterApprovalPanel.tsx` — fan-out missing approvals across all managers per team; include managers missing from the current roster_version even when other approvals exist; relax the create-records button gating.

No database migration, no edge-function change, no schema change. The existing UNIQUE constraint on `(roster_id, manager_id, team_id)` already supports multiple managers per team.

## Verification

After deploy, on the active 2027 Turbine Troubleshooting Offshore roster:
- MAONI sees a "Missing approval records" entry for herself and a "Create approval records" button.
- After clicking it, MAONI sees Approve / Request Changes buttons.
- ERBET's existing approval state is untouched.
- Both managers' approvals are required for the roster to flip to `approved`.
