

## Fix: Allow Managers/Admins to Remove Themselves from a Team

### Problem

Line 1170 of `EnhancedTeamManagement.tsx` has a guard `member.user_id !== user?.id` that hides the entire actions dropdown (edit, remove, etc.) for the current user's own row. This prevents managers from removing themselves from any team.

### Solution

Show a limited actions menu for the current user's own row that only includes the "Remove from Team" option (no edit/password actions on yourself). Keep the full menu for other members.

### Change

**File: `src/components/schedule/EnhancedTeamManagement.tsx`** (~line 1170-1203)

Replace the single conditional block with two blocks:

1. **Other users** (existing behavior): Show full dropdown when `member.user_id !== user?.id && canManageTeamMembers(team.id)`
2. **Self-removal**: Show a minimal dropdown with only "Remove from Team" when `member.user_id === user?.id && canManageTeamMembers(team.id)`

This gives managers the ability to remove themselves from teams while keeping edit/password actions restricted to other users only.

