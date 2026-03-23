
Do I know what the issue is? Yes.

What I confirmed
- The red errors in your screenshot are not generic network errors; they come directly from the custom `withTimeout` helper in `src/pages/Dashboard.tsx` (`timed out after 6000ms`).
- Auth is succeeding, but slowly: Supabase auth logs show `/user` returning `200`, and your dashboard still knows the signed-in email (`Welcome back, erbet`), so this is not a “missing user/profile row” problem.
- Right after login, the app fires several separate direct table queries on the hot path:
  - `profiles`
  - `user_roles`
  - `team_members`
  - `schedule_entries`
  - plus more in `UserMenu`, `AppSidebar`, and `PendingRequestsCard`
- Because the UI aborts these after 6s, it turns slow startup into permanent empty states (`No roles assigned`, `No teams assigned`, empty schedule), which is why it feels locked.

Actual root cause
- Primary cause: `Dashboard.tsx` is failing its own requests with an artificial 6-second `Promise.race` timeout.
- Secondary cause: the app duplicates user bootstrap queries across multiple components immediately after auth resolves.
- Contributing cause: those startup reads hit direct RLS-protected tables, while this project already has safer/faster RPC patterns (`get_basic_profile_info`, `get_multiple_basic_profile_info`, `get_team_members_safe`) that are not being used consistently.

Implementation plan
1. Remove the false-failure timeout path
- Delete the `withTimeout` wrapper from `src/pages/Dashboard.tsx`.
- Stop converting slow requests into hard errors after 6000ms.
- Keep per-card loading states instead of wiping data and rendering empty fallbacks.

2. Centralize current-user bootstrap
- Add one shared hook/service for current user context, e.g.:
  - profile/basic identity
  - roles array
  - teams
- Use it in:
  - `Dashboard.tsx`
  - `UserMenu.tsx`
  - `AppSidebar.tsx`
  - `PendingRequestsCard.tsx`
- This removes 4 separate startup fetch chains after login.

3. Replace direct hot-path table reads with RPC-backed reads
- Use existing secure RPCs where available:
  - `get_basic_profile_info` for current user identity
- Add a small security-definer RPC if needed for the remaining bootstrap payload, e.g. `get_current_user_context()` returning:
  - first_name
  - last_name
  - initials
  - email
  - roles[]
  - teams[]
- This avoids repeating direct reads against `profiles`, `user_roles`, and `team_members` during app startup.

4. Make dashboard resilient instead of all-or-nothing
- Separate shell loading from card loading.
- Load profile/roles/teams/schedule independently.
- Preserve partial success:
  - if profile is ready, show identity
  - if roles are still loading, show a skeleton instead of “No roles assigned”
  - if teams are still loading, show a skeleton instead of “No teams assigned”

5. Tighten auth-to-app handoff
- Keep the auth safety timeout as a fallback only.
- Ensure post-login screens wait for the shared bootstrap hook instead of each component launching its own first-load requests.

6. Verify the real broken flow
- Test cold login on preview and published site.
- Confirm:
  - no `timed out after 6000ms` console errors
  - dashboard cards populate after login
  - avatar/menu show real identity
  - roles/teams no longer flash as empty
  - schedule data eventually loads instead of being marked failed

Files likely to update
- `src/pages/Dashboard.tsx`
- `src/components/navigation/UserMenu.tsx`
- `src/components/navigation/AppSidebar.tsx`
- `src/components/dashboard/PendingRequestsCard.tsx`
- `src/components/auth/AuthProvider.tsx`
- `src/hooks/useCurrentUserContext.ts` (new shared hook)
- `supabase/migrations/*` (if adding `get_current_user_context()`)

Technical details
- The immediate visible bug is the client-side timeout logic, not missing database data.
- The durable fix is to remove self-imposed request failures and stop scattering direct RLS-heavy startup queries across multiple components.
- Existing RPC usage elsewhere in the app shows the right pattern; the login/dashboard surfaces need to use the same approach.
