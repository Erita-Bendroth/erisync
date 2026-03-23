
Fix: Missing initials are now a confirmed data-sync plus consistency issue, not just a single insert bug.

What I found
- Do I know what the issue is? Yes.
- The broken user row still has `profiles.first_name = ''` and `profiles.initials = NULL`.
- But the same user’s `auth.users.raw_user_meta_data.initials` already contains the correct value (`NIBAD`).
- The previous backfill only did `initials = first_name`, so it skipped users where both fields were blank.
- Different parts of the app render initials differently:
  - Team overview/team members read raw `profiles` data and can show blank.
  - Weekly schedule reads `get_team_members_safe`, which uses a different fallback path.
- Result: one broken profile row causes inconsistent display across screens.

Implementation plan

1. Repair existing broken users in the database
- Add a migration that backfills missing profile initials from `auth.users.raw_user_meta_data->>'initials'`.
- Also populate `first_name` for initials-only users when it is blank, so the existing UI patterns keep working.
- Keep a secondary fallback of `initials = first_name` for older rows that already store initials there.

2. Normalize the database read helpers
- Update the profile-returning SQL functions so they all compute initials the same way:
  - use `profiles.initials` if present
  - otherwise derive from first/last name
  - otherwise use initials-only first_name
  - never return an empty display value if usable data exists
- Specifically align:
  - `get_team_members_safe`
  - `get_all_basic_profiles`
  - `get_basic_profile_info`
- This removes the current mismatch between admin/team views and the weekly scheduler.

3. Harden the create-user flow for future users
- In `supabase/functions/create-user/index.ts`, keep the current `upsert`, but strengthen it:
  - normalize initials server-side (`trim().toUpperCase()`)
  - use the normalized value in auth metadata and profile upsert
  - stop returning success if profile/role/team writes fail
  - if a downstream write fails, return a real error instead of silently leaving a half-created user
- This makes new-user creation reliable instead of “success with broken profile data”.

4. Make the UI use one consistent display fallback
- Add a shared helper in `src/lib/utils.ts` for display initials/name fallback.
- Use that helper in:
  - `src/components/schedule/EnhancedTeamManagement.tsx`
  - `src/components/schedule/unified/UnifiedTeamScheduler.tsx`
  - `src/components/schedule/unified/TeamSection.tsx`
- This ensures the team members table and weekly schedule never show a blank identifier again, even if a profile is temporarily incomplete.

5. Validate the exact user and the future flow
- Re-check the currently broken user in:
  - Team Members list
  - Weekly scheduler under Technical Support Central
- Then create a brand-new test user from Admin Setup and verify initials appear immediately in both places without manual repair.

Files/resources to update
- `supabase/migrations/<new_migration>.sql`
- `supabase/functions/create-user/index.ts`
- `src/lib/utils.ts`
- `src/components/schedule/EnhancedTeamManagement.tsx`
- `src/components/schedule/unified/UnifiedTeamScheduler.tsx`
- `src/components/schedule/unified/TeamSection.tsx`

Expected outcome
- The already-broken user gets fixed.
- New users created from Admin Setup store initials correctly every time.
- Team overview and weekly schedule show the same initials consistently.
