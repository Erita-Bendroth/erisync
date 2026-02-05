

## Fix Frontend Edit Permission Checks in UnifiedTeamScheduler

### Problem
VYMUT is a manager of "Plant Operations Central" and the database correctly grants edit access to this team plus its 3 child teams. However, the **UnifiedTeamScheduler frontend component is not using the `canEditTeam` function** from `useScheduleAccessControl` to gate the editing UI.

The database functions work correctly:
- `get_manager_editable_teams('VYMUT')` returns 4 teams
- `has_manager_edit_access()` returns `true` for all 4 teams

The issue is on the frontend:
- Cells are clickable regardless of permissions
- The edit dialog opens without checking `canEditTeam`
- No visual indication of read-only cells
- RLS blocks the save attempt, but users see this as "no editing rights"

---

### What Needs to Change

| Component | Current Behavior | Fixed Behavior |
|-----------|------------------|----------------|
| `UnifiedTeamScheduler` | Passes `setEditingCell` directly | Wrap handler to check `canEditTeam(teamId)` first |
| `TeamSection` | No `canEdit` prop | Accept and use `canEdit` prop to disable interactions |
| `SchedulerCell` | Always shows pointer cursor | Show `not-allowed` cursor for read-only cells |
| Bulk operations | No permission check | Filter selected cells to only include editable teams |

---

### Technical Implementation

**File: `src/components/schedule/unified/UnifiedTeamScheduler.tsx`**

1. Create a wrapped double-click handler that checks permissions:
```typescript
const handleCellDoubleClick = (cellId: string, teamId: string) => {
  if (!accessControl.canEditTeam(teamId)) {
    toast({
      title: "View Only",
      description: "You can only view this team's schedule. Contact a planner for changes.",
      variant: "default",
    });
    return;
  }
  setEditingCell(cellId);
};
```

2. Pass `canEdit` prop to `TeamSection`:
```typescript
<TeamSection
  ...
  canEdit={accessControl.canEditTeam(section.teamId)}
  onCellDoubleClick={(cellId) => handleCellDoubleClick(cellId, section.teamId)}
/>
```

3. Add permission checks to bulk operations (`handlePaste`, `handleQuickAssign`, `handleClear`).

---

**File: `src/components/schedule/unified/TeamSection.tsx`**

1. Add `canEdit?: boolean` prop
2. Pass `canEdit` to `SchedulerCellWithTooltip`
3. Conditionally disable event handlers when `canEdit = false`

---

**File: `src/components/schedule/unified/SchedulerCell.tsx`**

1. Add `canEdit?: boolean` prop
2. Change cursor: `canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'`
3. Prevent click/double-click when `canEdit = false`

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/schedule/unified/UnifiedTeamScheduler.tsx` | Add permission check wrapper for cell actions, pass `canEdit` to TeamSection |
| `src/components/schedule/unified/TeamSection.tsx` | Accept and pass `canEdit` prop |
| `src/components/schedule/unified/SchedulerCell.tsx` | Visual indication for read-only cells |
| `src/components/schedule/unified/SchedulerCellWithTooltip.tsx` | Pass through `canEdit` prop |

---

### Expected Result

After this fix:
- VYMUT will see their editable teams (Plant Operations Central + 3 children) as clickable
- Teams they can only view will show as read-only with a visual indicator
- Double-clicking a read-only cell shows a toast explaining the limitation
- Bulk operations only apply to cells in editable teams

