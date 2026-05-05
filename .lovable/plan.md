## Two changes

### 1. Bigger substitute pool

Today the "Assign substitute" dialog only lists members of the single team that opened the dialog (via `get_team_members_safe(_team_id)`). For the Plant Operations Central case, that's just 11 people.

Switch to listing **all members of every team the absent person belongs to** (deduplicated). So if the absent user is in Plant Ops Central + Plant Support Central-South, the picker will show the union of both rosters.

**How**
- New `SECURITY DEFINER` SQL function `get_substitute_candidates(_absent_user_id uuid)` returning `(user_id, first_name, last_name, initials)` for the union of members across all teams the absent user belongs to (excluding the absent user themself), with email masking consistent with the rest of the app.
- `SubstituteAssignmentDialog.tsx`:
  - When an absent person is chosen, call the new RPC instead of `get_team_members_safe(team_id)` for the "Substitute" dropdown.
  - Keep the existing "Absent person" list scoped to the current team (so the manager still picks from the team they opened the dialog for).
  - Show a small caption like *"Showing N candidates across the absentee's teams"*.

No RLS or app-permission changes (function is `SECURITY DEFINER` and only callable by authenticated users).

### 2. Co-managers on a team — make it a real, repeatable concept

The product already supports multiple managers per team via `team_members.is_manager = true` (security functions like `get_manager_accessible_teams` already grant equal mandate, vacation approval, schedule edit etc. to anyone with that flag). The actual problem is just **data**: HEKOT has the global `manager` role but is *not* flagged `is_manager` on `Turbine Troubleshooting Central – North, West, East, South`, so they don't share TOSTU's mandate on that team.

So the answer to "is there a way to do that for any future team?" is: **yes, it already works** — the rule is "set `is_manager=true` on the team_members row." The UI in EnhancedTeamManagement → Add Member already exposes a "Make manager" toggle, but two things make it easy to miss / get wrong:

1. **No visible indicator** that a team has more than one manager.
2. **No way to promote/demote an existing member** to manager from the UI — you have to re-add them.

**Plan**
- **Data fix now** (one-off): set `is_manager = true` on `team_members` row for HEKOT in `Turbine Troubleshooting Central – North, West, East, South`, so HEKOT and TOSTU share equal mandate.
- **UI: Promote/Demote control on existing members.** In `EnhancedTeamManagement.tsx`, on each member row add a small "Make manager" / "Remove manager" action (visible to admin/planner and to existing managers of that team). It just updates `team_members.is_manager`.
- **UI: Co-manager indicator.** On the team card, when more than one member has `is_manager=true`, show a "2 managers" badge listing their initials, so it's obvious at a glance.
- **Docs/help text.** Add a short tooltip on the "Make manager" toggle: *"Multiple managers on the same team share equal mandate (planning, approvals, schedule edits)."*

This way, for any future team, an admin/planner/manager flips the toggle on whichever members should co-manage and the rest of the system (vacation approvals, schedule edits, hotline config, roster approvals) automatically treats them with equal mandate via existing RLS.

### Files

- New migration: `get_substitute_candidates` SQL function.
- Data update via insert tool: set `is_manager = true` for HEKOT on the Troubleshooting team.
- `src/components/schedule/SubstituteAssignmentDialog.tsx` — switch substitute list source.
- `src/components/schedule/EnhancedTeamManagement.tsx` — add promote/demote action + co-manager badge + tooltip.

Out of scope: changing the rule itself (multiple managers already work via `is_manager`), bulk promotion across teams, manager hierarchy UI.
