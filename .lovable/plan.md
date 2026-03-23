

## Fix: App Not Loading After Self-Removal From Team

### Root Cause

Yes, removing yourself from a team is contributing to the problem. Here's how:

1. **Multiple components fetch roles independently** — `Schedule.tsx`, `ScheduleView.tsx`, `EnhancedTeamManagement.tsx`, `AppSidebar.tsx`, `UserMenu.tsx`, and `Dashboard.tsx` all launch separate `user_roles` and `team_members` queries on mount
2. **Manager-path RPCs return empty** — When you're no longer in `team_members`, RPCs like `get_manager_editable_teams` and `get_manager_accessible_teams` return empty arrays, causing:
   - Empty teams in schedule views
   - No employees loaded
   - "Loading teams..." stuck state in Team Management
3. **Admin role not being used as fallback** — Many components check `isManager()` first and go down the manager code path (which requires team membership), even though you also have `admin` role which should bypass team membership checks

### What needs to change

**1. Re-add you to your team (database fix)**
- Query your current team membership status
- If missing, identify the correct team and re-add you via a migration or direct insert

**2. Make admin role bypass team membership checks consistently**
- In `ScheduleView.tsx` `fetchEmployees()`: the admin path should fetch all employees without needing team membership
- In `EnhancedTeamManagement.tsx` `fetchTeamsAndMembers()`: admin path already fetches all teams (line 321-324), but the loading gate at line 122-128 (`if (userRoles.length > 0)`) could fail if the roles query is slow
- In `Schedule.tsx` `fetchTeams()`: admin path fetches all teams (line 119), this is correct

**3. Remove the loading deadlock in EnhancedTeamManagement**
- `loading` starts `true` (line 75)
- `fetchTeamsAndMembers()` is only called when `userRoles.length > 0` (line 123)
- If `fetchUserRoles()` is slow or fails, `loading` stays `true` forever → permanent "Loading teams..." spinner
- Fix: add a timeout or set `loading = false` when roles come back empty

**4. Consolidate role fetching**
- Use the shared `useCurrentUserContext` hook (already created) in `Schedule.tsx`, `ScheduleView.tsx`, and `EnhancedTeamManagement.tsx` instead of each component fetching roles independently

### Files to update

| File | Change |
|------|--------|
| `src/components/schedule/EnhancedTeamManagement.tsx` | Use `useCurrentUserContext` for roles; fix loading deadlock when roles are empty or slow |
| `src/pages/Schedule.tsx` | Use `useCurrentUserContext` for roles instead of independent fetch |
| `src/components/schedule/ScheduleView.tsx` | Use `useCurrentUserContext` for roles; ensure admin path works without team membership |
| `src/hooks/useCurrentUserContext.ts` | Ensure it handles the case where user has roles but no teams gracefully |

### Expected outcome
- App loads immediately after login regardless of team membership
- Admin users see all data even without being in a team
- No more "Loading teams..." deadlock
- No more redundant role queries on every page

