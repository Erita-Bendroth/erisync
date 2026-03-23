
Fix: login/profile rendering is now failing for two linked reasons, not one.

What I found
- The auth timeout is firing first: console shows `Auth initialization timed out, proceeding without session`, then `SIGNED_IN`.
- That means the app renders in a partial state before all user/profile data is ready.
- The top-right avatar showing only `U` is because `src/components/navigation/UserMenu.tsx` fetches:
  - `profiles ... .single()`
  - `user_roles ... .single()`
- That is fragile here:
  - many users have multiple roles, so `.single()` on `user_roles` is wrong
  - if the profile query is delayed or returns no visible row, the fallback becomes `'U'`
- The schedule page can also get stuck because `src/components/schedule/ScheduleView.tsx` Phase 2 waits for `userRoles.length > 0` before loading employees/schedule data. If roles fail to populate promptly, the page stays on “Loading schedule…”.
- There is also inconsistent profile fetching across the app:
  - some places query `profiles` directly
  - others use secure RPCs like `get_basic_profile_info`
  - this inconsistency is why login can succeed but the visible user info is incomplete.

Plan
1. Stabilize auth initialization
- Update `AuthProvider` so the timeout does not leave the app in a misleading half-ready state.
- Keep the timeout as a fail-safe, but introduce a distinct “auth resolved vs app data loading” flow so signed-in users are not treated like anonymous users during late session resolution.
- Ensure the initial render after timeout can recover cleanly when `SIGNED_IN` arrives.

2. Fix the user menu data source
- Refactor `src/components/navigation/UserMenu.tsx` to stop using `.single()` on `user_roles`.
- Fetch roles as an array and derive the highest-priority label (admin > planner > manager > teammember).
- Fetch profile data with a safer fallback path so the menu can show:
  - initials
  - display name
  - email
  even if one field is temporarily missing.
- Replace the current `'U'` fallback with a proper helper that uses initials, then name-derived initials, then email-derived fallback.

3. Unblock the schedule loading flow
- Adjust `src/components/schedule/ScheduleView.tsx` so Phase 2 does not hard-block on `userRoles.length > 0`.
- Load schedule data once static fetches complete, and treat “no roles found yet” separately from “still loading”.
- Add defensive completion paths so `loading` is always cleared even when one of the supporting queries returns empty data.

4. Standardize profile/role reads
- Replace fragile direct queries in key entry points with a shared pattern:
  - profile fetch with safe fallback
  - roles fetch as array, never `.single()`
- Apply this to:
  - `UserMenu.tsx`
  - `AppSidebar.tsx`
  - `Dashboard.tsx`
  - any other header/profile surfaces contributing to the broken post-login state

5. Add one shared display helper
- Extend `src/lib/utils.ts` with a single helper for display name + initials resolution.
- Use it in the user menu and any affected schedule/team surfaces so the same logged-in user never appears as blank in one place and complete in another.

6. Verify the exact broken flow
- Re-test:
  - login on deployed site
  - top-right user menu
  - dashboard header/profile state
  - schedule page loading
- Specifically confirm the current user no longer appears as just `U`, and that schedule data loads after sign-in.

Files likely to update
- `src/components/auth/AuthProvider.tsx`
- `src/components/navigation/UserMenu.tsx`
- `src/components/navigation/AppSidebar.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/schedule/ScheduleView.tsx`
- `src/lib/utils.ts`

Expected result
- Login completes without the app getting stranded in a partial state.
- The current user shows proper initials/name/email instead of just `U`.
- The schedule page no longer hangs on “Loading schedule...” because role loading is no longer a hard gate.
