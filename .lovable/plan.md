

## Fix: Team Page Reloads and Collapses After Removing a Member

### Problem

When removing a team member, `removeTeamMember` calls `fetchTeamsAndMembers()`, which sets `setLoading(true)` at line 289. This causes the entire teams UI to re-render with a loading spinner, collapsing all expanded `Collapsible` components. The user loses their place.

### Solution

Update `removeTeamMember` to do a **lightweight refresh** that only updates the member list for the affected team, without triggering a full loading state.

### What Changes

**File: `src/components/schedule/EnhancedTeamManagement.tsx`**

Replace the `fetchTeamsAndMembers()` call in `removeTeamMember` with an inline member-only refresh for the specific team:

```typescript
const removeTeamMember = async (memberId: string, teamId: string) => {
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;

    toast({ title: "Success", description: "Team member removed successfully" });

    // Instead of full reload, just remove the member from local state
    setTeamMembers(prev => ({
      ...prev,
      [teamId]: (prev[teamId] || []).filter(m => m.id !== memberId)
    }));
  } catch (error: any) {
    // ... existing error handling
  }
};
```

This optimistically removes the member from the local `teamMembers` state for that specific team, avoiding any loading state or re-fetch. The expanded team stays open, and the user stays in context.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/schedule/EnhancedTeamManagement.tsx` | Replace `fetchTeamsAndMembers()` with optimistic local state update in `removeTeamMember` |

