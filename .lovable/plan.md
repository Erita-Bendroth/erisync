
## Restrict Manager Edit Permissions to Explicit Team Assignments

### Overview
This change modifies the edit permission logic so managers can only edit schedules for teams where they are **explicitly** marked as `is_manager = true`. Viewing capabilities remain fully unchanged.

---

### What Changes

| Function | Current Behavior | New Behavior |
|----------|------------------|--------------|
| `get_manager_editable_teams()` | Returns teams where `is_manager = true` **plus all descendant teams** | Returns **only** teams where `is_manager = true` |
| `get_manager_accessible_teams()` | Returns all accessible teams recursively | **No change** - remains recursive |

---

### What Stays The Same

All viewing features are **completely unaffected**:

- Viewing team schedules in multi-team view
- Viewing team availability calendars
- Co-planning partnership calendars and configurations
- Vacation request visibility
- Shift swap request visibility
- Profile viewing for accessible teams
- Analytics dashboards
- Coverage heatmaps and reports

These all use `get_manager_accessible_teams()` which remains recursive.

---

### Impact Example

**HADJO** (member of 2 teams with `is_manager = true`):
- **Current**: Can edit 5 teams (2 explicit + 3 descendants)
- **After fix**: Can edit 2 teams (only explicit assignments)
- **Unchanged**: Can still VIEW all 5+ teams through the hierarchy

**Top-level managers** (like GESCH):
- Will only be able to edit teams where they are explicitly assigned as manager
- To edit sub-teams, they need to be explicitly added to those teams as manager
- Can still VIEW all teams in their hierarchy

---

### Technical Implementation

**File: New SQL Migration**

Update the `get_manager_editable_teams()` function to remove recursive descent:

```sql
CREATE OR REPLACE FUNCTION public.get_manager_editable_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return teams where user is EXPLICITLY marked as manager
  -- This does NOT cascade to child teams - managers must be 
  -- explicitly assigned to each team they can edit
  SELECT tm.team_id 
  FROM public.team_members tm
  WHERE tm.user_id = _manager_id
    AND tm.is_manager = true;
$$;
```

---

### Affected RLS Policies (No Changes Needed)

The following policies use `has_manager_edit_access()` which calls the updated function. They will automatically enforce the new stricter permissions:

| Table | Operation | Policy |
|-------|-----------|--------|
| `schedule_entries` | INSERT | "Managers can insert schedule entries for editable teams" |
| `schedule_entries` | UPDATE | "Managers can update schedule entries for editable teams" |
| `schedule_entries` | DELETE | "Managers can delete schedule entries for editable teams" |

---

### Frontend Changes

**File: `src/hooks/useScheduleAccessControl.ts`**

The `canEditTeam()` function already calls `get_manager_editable_teams` RPC - it will automatically work with the new logic. The frontend correctly uses:
- `editableTeams` set for edit controls
- Separate viewing logic that remains unaffected

No frontend code changes required.

---

### Verification Steps

After implementation:
1. HADJO should only be able to edit schedules for their 2 explicit teams
2. HADJO should still be able to VIEW all teams in their accessible hierarchy
3. Co-planning features should continue working normally
4. Top-level managers like GESCH will need explicit team assignments if they want to edit sub-teams directly

---

### Summary

This is a minimal, surgical change that:
- Modifies only **one database function** (`get_manager_editable_teams`)
- Leaves all **viewing logic completely untouched**
- Requires **no frontend code changes**
- Preserves all partnership, availability, and co-planning features
