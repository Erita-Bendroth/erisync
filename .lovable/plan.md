

## Enable Hierarchical Team Management for Managers

### Problem

VYMUT is a manager of "Plant Operations Central" and should be able to:
1. Add members to their team and child teams
2. Edit users in their team and child teams  
3. Remove members from their team and child teams

Currently:
- The "Add Member" button only shows for admin/planner (line 910: `canEditTeams()`)
- The member actions dropdown (Edit, Remove, Password) shows for everyone but fails at RLS level
- RLS uses `is_manager_of_team()` which does NOT cascade to child teams

The database function `get_manager_editable_teams()` correctly returns 4 teams for VYMUT:
- Plant Operations Central (direct)
- Plant Support Central - North (child)
- Plant Support Central - South (child)
- Plant Troubleshooting Central (child)

But the `team_members` RLS policy uses `is_manager_of_team()` which only checks direct assignment.

---

### What Changes

| Component | Current | Fixed |
|-----------|---------|-------|
| RLS on `team_members` | Uses `is_manager_of_team()` (no hierarchy) | Use `has_manager_edit_access()` (includes hierarchy) |
| "Add Member" button | Shows only for admin/planner | Also shows for managers of displayed teams |
| Member actions dropdown | Shows for everyone, fails silently at RLS | Check `canManageTeamMembers(teamId)` before showing |
| Frontend permission logic | Uses `canEditTeams()` (admin/planner only) | Add `canManageTeamMembers(teamId)` that checks hierarchy |

---

### Database Change

Update the RLS policy on `team_members` to use hierarchical access:

```sql
-- Drop and recreate the manager policy for team_members
DROP POLICY IF EXISTS "managers_manage_own_team_members" ON public.team_members;

CREATE POLICY "managers_manage_own_team_members" ON public.team_members
FOR ALL
TO authenticated
USING (
  public.has_manager_edit_access(auth.uid(), team_id)
)
WITH CHECK (
  public.has_manager_edit_access(auth.uid(), team_id)
);
```

This uses `has_manager_edit_access()` which already checks `get_manager_editable_teams()` with hierarchy support.

---

### Frontend Changes

**File: `src/components/schedule/EnhancedTeamManagement.tsx`**

1. Add state for editable teams and fetch them on mount:
```typescript
const [editableTeams, setEditableTeams] = useState<Set<string>>(new Set());

// In useEffect, fetch editable teams for managers
if (isManager() && user) {
  const { data } = await supabase.rpc('get_manager_editable_teams', { 
    _manager_id: user.id 
  });
  if (data) setEditableTeams(new Set(data));
}
```

2. Add helper function:
```typescript
const canManageTeamMembers = (teamId: string) => {
  if (isAdmin() || isPlanner()) return true;
  return editableTeams.has(teamId);
};
```

3. Update "Add Member" button visibility (around line 910):
```typescript
// Show for admin/planner OR if manager has editable teams
{(canEditTeams() || editableTeams.size > 0) && (
  <Dialog open={addMemberOpen} ...>
```

4. In the Add Member dialog, filter team dropdown to only show editable teams:
```typescript
{teams.filter(t => canManageTeamMembers(t.id)).map((team) => (
  <SelectItem key={team.id} value={team.id}>
    {team.name}
  </SelectItem>
))}
```

5. Gate member actions dropdown (around line 1117):
```typescript
{member.user_id !== user?.id && canManageTeamMembers(team.id) && (
  <DropdownMenu>
    ...
  </DropdownMenu>
)}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| New SQL Migration | Update RLS policy on `team_members` to use hierarchical access |
| `src/components/schedule/EnhancedTeamManagement.tsx` | Add editable teams state, helper function, and gate UI elements |

---

### Expected Result

After this fix:
- VYMUT can add members to Plant Operations Central and its 3 child teams
- VYMUT can edit/remove members from those same 4 teams
- VYMUT does NOT see actions for teams outside their hierarchy
- The Add Member button appears for managers who have at least one editable team
- Team dropdown in Add Member dialog only shows teams the manager can edit

