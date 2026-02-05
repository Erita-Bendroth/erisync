

## Restore Hierarchical Edit Permissions (Downward Cascade)

### Overview
Restore the recursive behavior for `get_manager_editable_teams()` so managers can edit:
1. Teams where they are explicitly marked as `is_manager = true`
2. All descendant teams below those teams

---

### What Changes

| Function | Current Behavior | New Behavior |
|----------|------------------|--------------|
| `get_manager_editable_teams()` | Returns **only** teams where `is_manager = true` | Returns teams where `is_manager = true` **plus all descendant teams** |

---

### Expected Results

| Manager | Edit Access |
|---------|-------------|
| **GESCH** (top-level) | Can edit all ~20 teams in hierarchy below |
| **BJPE** (mid-level) | Can edit their team + all sub-teams (~5 teams) |
| **HADJO** (if assigned to leaf only) | Can edit only their specific team |

---

### Technical Implementation

**File: New SQL Migration**

Restore the recursive CTE in `get_manager_editable_teams()`:

```sql
CREATE OR REPLACE FUNCTION public.get_manager_editable_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE manager_teams AS (
    -- Base case: teams where user is explicitly marked as manager
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = _manager_id
      AND tm.is_manager = true
    
    UNION
    
    -- Recursive case: include all descendant teams
    SELECT t.id
    FROM public.teams t
    INNER JOIN manager_teams mt ON t.parent_team_id = mt.team_id
  )
  SELECT team_id FROM manager_teams;
$$;
```

---

### Data Consideration

If HADJO should only edit their leaf team:
- Ensure HADJO is marked as `is_manager = true` **only** on their leaf team
- Remove any `is_manager = true` flags from parent/mid-level teams they belong to

The hierarchy will then correctly cascade downward from each explicit manager assignment.

---

### Summary

This single database function change restores downward-cascading edit permissions:
- Managers edit their assigned teams + all teams below
- Viewing logic remains unchanged
- No frontend changes needed

