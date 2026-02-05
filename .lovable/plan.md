
## Fix: Child Teams Missing in Add Member Dialog

### Problem Identified

VYMUT is manager of "Plant Operations Central" (parent team only). The database correctly returns 4 editable teams via `get_manager_editable_teams()`:
1. Plant Operations Central (direct assignment)
2. Plant Support Central - North (child)
3. Plant Support Central - South (child)
4. Plant Troubleshooting Central (child)

However, in Team Management:
- The main team list (`teams` state) only shows "Plant Operations Central" - this is **intentional** to avoid cluttering the view
- The "Add Member" dialog team dropdown filters from `teams` state, which only has the parent team
- Child teams exist in `editableTeams` but are never shown in the dropdown

**The bug**: The Add Member dialog filters `teams.filter(t => canManageTeamMembers(t.id))` but `teams` doesn't contain child teams for managers.

---

### Solution

For the Add Member dialog, fetch full team details for all teams in `editableTeams` and use those in the dropdown instead of filtering the limited `teams` state.

---

### Technical Changes

**File: `src/components/schedule/EnhancedTeamManagement.tsx`**

1. **Add state for editable team details**:
```typescript
const [editableTeamDetails, setEditableTeamDetails] = useState<Team[]>([]);
```

2. **Enhance `fetchEditableTeams` to also fetch team details**:
```typescript
const fetchEditableTeams = async () => {
  if (!user) return;
  
  try {
    const { data: teamIds, error } = await supabase.rpc('get_manager_editable_teams', {
      _manager_id: user.id
    });
    
    if (error) throw error;
    if (teamIds && teamIds.length > 0) {
      setEditableTeams(new Set(teamIds));
      
      // Fetch full team details for these IDs
      const { data: teamDetails } = await supabase
        .from('teams')
        .select('id, name, description, parent_team_id')
        .in('id', teamIds)
        .order('name');
      
      setEditableTeamDetails(teamDetails || []);
    }
  } catch (error) {
    console.error('Error fetching editable teams:', error);
  }
};
```

3. **Update Add Member dialog team dropdown** (around line 982):
```typescript
// Replace:
{teams.filter(t => canManageTeamMembers(t.id)).map((team) => ...

// With:
{(canEditTeams() 
  ? teams  // Admins/planners see all teams
  : editableTeamDetails  // Managers see their hierarchical editable teams
).map((team) => (
  <SelectItem key={team.id} value={team.id}>
    {team.name}
  </SelectItem>
))}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/schedule/EnhancedTeamManagement.tsx` | Add `editableTeamDetails` state, enhance fetch function, update dropdown source |

---

### Expected Result

After this fix:
- VYMUT opens "Add Member" dialog
- Team dropdown shows all 4 teams: Plant Operations Central + 3 child teams
- VYMUT can add members to any of these 4 teams
- Admins/planners continue to see all teams as before
- Main team list still shows only the parent team (no change to that behavior)
