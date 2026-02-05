
### Goal
Make **child teams visible and manageable** in the **Team Management** (Teams tab) UI for managers like VYMUT who are only assigned as manager on the **parent team** but have hierarchical edit access to **child teams**.

---

### What’s happening now (root cause)
In `src/components/schedule/EnhancedTeamManagement.tsx`, the main “Team Management” list is intentionally restricted for managers:

- `fetchTeamsAndMembers()` has a manager-only branch that fetches **only directly-managed teams** from `team_members` where `is_manager = true`.
- Even though we now fetch `editableTeamDetails` (parent + children) in `fetchEditableTeams()`, that data is currently used only for the **Add Member** dialog dropdown.
- Therefore, VYMUT sees only “Plant Operations Central” as a team card, and cannot view/edit members of the child teams because those teams are never rendered in the main list.

So the fix is: **for managers, the main `teams` list must come from the hierarchical editable teams list**, not the directly-managed list.

---

### Solution approach
Update `EnhancedTeamManagement.tsx` so that:

1. **Managers see all teams they can manage members for** (the result of `get_manager_editable_teams()`), including child teams.
2. The UI uses the **same source of truth** (editable team IDs) for:
   - Which team cards are shown
   - Which team members are loaded
   - Which teams can be selected in “Add Member”
3. Ensure loading order/race conditions are avoided by fetching editable team IDs within the same data-loading path as teams/members (not relying on a separate effect finishing “in time”).

---

### Detailed implementation plan

#### 1) Refactor manager team fetching to use hierarchical editable teams
**File:** `src/components/schedule/EnhancedTeamManagement.tsx`  
**Function:** `fetchTeamsAndMembers`

Replace the current manager-only logic (direct manager teams filtering) with:

- Call `supabase.rpc('get_manager_editable_teams', { _manager_id: user.id })`
- If it returns IDs, query `teams` with `.in('id', teamIds)` and set those as `teamsData`
- Also set:
  - `editableTeams` (Set of IDs) for permission gating
  - `editableTeamDetails` (team rows) so the Add Member dropdown remains correct

This ensures the team cards displayed match what the manager can actually manage.

Notes:
- Keep admin/planner behavior unchanged (they still see all teams).
- Keep teammember behavior unchanged (if any logic exists later; currently managers/planners/admins use this component).

#### 2) Make data loading deterministic (avoid race between effects)
Currently `fetchEditableTeams()` runs in one effect, and `fetchTeamsAndMembers()` runs in another effect after roles load. That can cause timing issues where `teams` is computed before editable teams are available.

To eliminate timing issues:
- In the manager branch inside `fetchTeamsAndMembers()`, always fetch editable team IDs directly (as above).  
- Keep `fetchEditableTeams()` if it’s still useful for immediate gating, but treat it as “nice to have”; the manager branch in `fetchTeamsAndMembers()` becomes authoritative.

(Optionally, after this change, we can simplify by removing the separate `fetchEditableTeams()` call and just derive `editableTeams` from `fetchTeamsAndMembers()` for managers. But we’ll do this only if it doesn’t break other UI assumptions.)

#### 3) Ensure member loading covers child teams
Because `fetchTeamsAndMembers()` loops `for (const team of teamsData)` to fetch `team_members` per team, once `teamsData` includes children, their member lists will load automatically.

No new queries required beyond the change in how `teamsData` is built.

#### 4) Optional: improve hierarchy display (nice-to-have, not required for correctness)
Once child teams appear, they may show as a flat list. If you want a clearer UX, we can:
- Use `parent_team_id` to group teams and render parent/child indentation or nested cards.
- There is already a helper file `src/lib/teamHierarchyUtils.ts` that can group teams by hierarchy.

This is optional; the immediate fix is simply to show all editable teams.

---

### Acceptance criteria (how we’ll confirm it’s fixed)
Using VYMUT (manager on parent only):

1. Navigate to **Schedule → Teams** (Team Management).
2. The page shows **4 team cards/sections**:
   - Plant Operations Central
   - Plant Support Central - North
   - Plant Support Central - South
   - Plant Troubleshooting Central
3. Expanding each team shows members; action menus (Edit/Remove/Password) appear where allowed.
4. VYMUT can remove/add members in child teams without RLS errors.
5. “Add Member” dialog Team dropdown still shows those 4 teams.

---

### Files involved
- `src/components/schedule/EnhancedTeamManagement.tsx` (primary and likely only file change)

---

### Risks / edge cases
- If `get_manager_editable_teams()` returns teams that the manager can edit but cannot *select* from `teams` due to RLS on `teams` table, the `.in('id', teamIds)` query could return fewer teams. If that happens, we’ll need to adjust `teams` table SELECT RLS to align with `get_manager_editable_teams()` visibility.
- If the RPC returns IDs but the client query hits a row limit or policy issue, we’ll add logging/toasts to make failures visible.

---

### Testing checklist
- Log in as VYMUT.
- Verify the Team Management screen shows child teams.
- Expand each child team and confirm members load.
- Try: Add member to each child team, remove member from each child team.
- Confirm admin/planner still see the full list of teams unchanged.
