
Fix: the deployed login issue is now confirmed to be a client-side auth/loading problem, not a missing-profile data problem.

What I confirmed
- Do I know what the issue is? Yes.
- Supabase auth logs show your login succeeds.
- Your database row is correct: your profile already has `first_name = ERBET`, `initials = ERBET`, correct email, and multiple roles.
- So the `U / no other information` state is not caused by bad profile data.
- The console screenshot confirms the app is timing out auth initialization before the app is actually ready.
- `AuthProvider` has a stale timeout bug: the 5-second timer captures the initial `isInitialized = false`, so it can force a partial/anonymous render even while login is still resolving.
- After that, some screens still call `supabase.auth.getUser()` / `getSession()` again inside page loaders. If one of those hangs, the page can stay stuck and fall back to `User` / `U`.

What is actually broken
1. `src/components/auth/AuthProvider.tsx`
- The timeout logic is unsafe and can put the app into a false “not ready / no user” state.
- Recovery after a late `SIGNED_IN` event is not robust enough.

2. Route protection
- `src/App.tsx` and `src/components/Layout.tsx` do not enforce a real protected-route state.
- `Layout` currently returns `null` when `user` is missing, which creates blank/partial protected pages instead of a controlled redirect/loading flow.

3. Schedule loading
- `src/components/schedule/ScheduleView.tsx` still uses `supabase.auth.getUser()` inside fetch helpers.
- Those helpers are included in blocking load chains, so one hanging auth call can freeze the whole schedule load.
- This same file also injects placeholder employees with `initials: 'U'`, which explains the visible `User / U` fallback.

4. Identity rendering
- `UserMenu`, `Dashboard`, and schedule-related views do not share one consistent fallback path for signed-in users when profile data arrives late.

Implementation plan
1. Stabilize auth initialization
- Refactor `AuthProvider` to use a safe auth-status model instead of the current stale timeout check.
- Keep a timeout as a fallback, but do not treat timeout as “anonymous user”.
- Make sure a late `SIGNED_IN` always fully recovers the UI.

2. Add a real protected-route guard
- Update `ProtectedRoute` / `Layout` so protected pages:
  - show a controlled loading state while auth is resolving
  - redirect to `/auth` only when auth is truly resolved and there is no user
- Remove the current blank `return null` behavior for missing user state.

3. Remove repeated auth API calls from loaders
- In `ScheduleView`, replace internal `supabase.auth.getUser()` calls with `useAuth().user`.
- Break up the blocking `Promise.all(...)` load chain so one stalled request cannot freeze the full page.
- Use defensive completion paths so loading always clears.

4. Remove fake `User / U` placeholders
- Stop inserting `initials: 'U'` / `displayName: 'User'` for recoverable signed-in users.
- Prefer profile data, then auth email-derived fallback, then a neutral placeholder only as a last resort.

5. Standardize display identity
- Add a shared helper in `src/lib/utils.ts` for:
  - display name
  - avatar initials
  - email fallback
- Apply it in:
  - `src/components/navigation/UserMenu.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/components/schedule/ScheduleView.tsx`

6. Verify on the published site
- Re-test the published login flow specifically.
- Confirm:
  - no auth-timeout partial state
  - no blank protected route
  - no `U` avatar / `User` label after sign-in
  - dashboard and schedule both load with your real identity

Files to update
- `src/components/auth/AuthProvider.tsx`
- `src/App.tsx`
- `src/components/Layout.tsx`
- `src/components/schedule/ScheduleView.tsx`
- `src/components/navigation/UserMenu.tsx`
- `src/pages/Dashboard.tsx`
- `src/lib/utils.ts`

Technical note
- This does not currently look like a database migration issue.
- The login succeeds and the profile data exists.
- The failure is in client-side auth recovery and blocked page loaders.

Expected outcome
- Login no longer drops into a half-authenticated state.
- Protected pages render predictably.
- Your real initials/name appear instead of `U`.
- Dashboard and schedule stop hanging even when auth is slow.
