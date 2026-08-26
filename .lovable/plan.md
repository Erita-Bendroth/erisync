# Make vacation-day editing easy to find

## Goal
Let a manager edit a team member’s yearly vacation-day allowance from the same **Edit User** dialog they already use for that member.

## Changes
- Add a clearly labeled **Vacation days per year** number field to the existing Edit User dialog when it is opened from Team Management.
- Pre-fill it with the selected member’s allowance for the current year.
- Save profile changes and the vacation allowance together through the existing allowance update logic.
- Keep the field limited to managers who can manage that team, plus planners/admins, using the permissions already applied to the member Actions menu.
- Refresh the member statistics after saving so the updated allowance is immediately visible.

## Technical details
- Pass the selected member’s current `UserTimeStats` and the existing `updateAllowance` callback from `EnhancedTeamManagement` into `EditUserModal`.
- Preserve the member’s existing flextime allowance when only vacation days are changed.
- Keep the existing Team Member Overview allowance editor functional; this adds the missing discoverable entry point rather than changing allowance calculations.

## Validation
- Open a team member’s Actions menu as a manager, select **Edit User**, change vacation days, save, and confirm the current-year total updates.
- Confirm users without team-management permission do not gain access.
- Confirm ordinary profile-only edits still save correctly.
