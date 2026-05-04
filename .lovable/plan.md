# Create & Delete Teams

## Problem
Admins/Planners can edit teams (pencil icon) but there's no way to **create new teams** or **delete old ones** from the UI. RLS already permits both for admin/planner.

## Solution
Add two actions to the existing `EnhancedTeamManagement` header (Teams tab):
1. **"New Team"** button → dialog to create a team (name, description, optional parent team).
2. **Delete icon** next to each team's pencil/edit button → confirmation dialog warning about cascading data loss, then deletes.

Both are restricted to admin/planner via the existing `canEditTeams()` helper.

## Changes

### 1. New component: `src/components/schedule/CreateTeamModal.tsx`
- Inputs: `name` (required, unique check against `allTeams`), `description` (optional textarea), `parent_team` (optional Select from existing teams — used to nest as a child team).
- Validates duplicate names client-side, then `supabase.from('teams').insert({...})`.
- On success: toast + `onTeamCreated()` to refetch.

### 2. New component: `src/components/schedule/DeleteTeamDialog.tsx`
- AlertDialog confirming deletion of team `{name}`.
- Shows a warning listing what will be deleted via cascade: members, schedule entries, vacation requests, swap requests, shift definitions, capacity/hotline config, audit logs, child teams.
- Mentions blocking dependencies (roster approvals & week assignments) — if delete fails with FK violation, show a friendly error: "This team has roster data that must be removed first."
- Pre-check: query counts for `team_members`, `schedule_entries`, `roster_week_assignments`, `roster_manager_approvals` and display them so the admin sees impact before confirming.
- Requires typing the team name to confirm (typed-confirm pattern, since this is destructive and irreversible).
- On confirm: `supabase.from('teams').delete().eq('id', team.id)`.

### 3. Wire into `EnhancedTeamManagement.tsx`
- Header row: add **"New Team"** button next to "Add Member" (visible when `canEditTeams()`).
- Each team card row (around line 1074, next to the pencil edit button): add a small trash icon button (visible when `canEditTeams()`) that opens `DeleteTeamDialog`.
- After create/delete success, call the existing `fetchTeamsAndMembers()` to refresh.

## Permissions
No DB changes needed — RLS already allows:
- Insert: `Only planners can create teams` + `Admins can insert any team`
- Delete: `Admins can delete any team` + `Allow planners to manage`

## Out of scope
- Bulk team deletion.
- Soft-delete / archive.
- Manager-level team creation (still admin/planner only — matches current edit gating).
- Migration of members/schedules to another team before deletion (pure cascade for now).

## Files
- **Create**: `src/components/schedule/CreateTeamModal.tsx`
- **Create**: `src/components/schedule/DeleteTeamDialog.tsx`
- **Edit**: `src/components/schedule/EnhancedTeamManagement.tsx` (header button + per-row delete icon + state hookups)
