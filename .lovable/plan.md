## What's actually happening

Your "the page reloads back to Schedule view" symptom is not a real navigation/reload. It's React tearing down the Partnership Settings dialog (and everything inside it) because the auth context emits a new `user` / `session` reference. Trigger sequence after a few minutes / coming back to the browser tab:

1. Supabase auto-refreshes the access token in the background.
2. `AuthProvider.onAuthStateChange` fires `TOKEN_REFRESHED` with a brand‑new `session` object, and unconditionally calls `setSession(...)` / `setUser(...)`.
3. The `useMemo` in `AuthProvider` recomputes the context value → every `useAuth()` consumer re-renders.
4. Inside `Schedule.tsx`, the cascade re-runs effects like `useEffect([user, contextLoading]) => fetchTeams()` and the `searchParams` effect that calls `setActiveTab(tabFromUrl)`. Combined with `useCurrentUserContext` flipping `contextLoading` while it refetches roles, the Tabs root briefly remounts the active `TabsContent`, which throws away `UnifiedTeamScheduler` → `PartnershipSelector` → `PartnershipCapacityConfig` → `PartnershipRotationManager` → the open `PartnershipWorkspace` / `RosterBuilderDialog`. Because those dialogs only live in local `useState` of components that just unmounted, they don't come back — you land on the visible default tab ("Schedule").
5. Visibility-change refocus makes Supabase do the same thing again, which is why "switch tabs and come back" reliably reproduces it.

In short: the dialog state is *correct*, but its host tree is being recreated underneath it on every token refresh.

## Fix

Three small, targeted changes. Nothing else in the app needs to move.

### 1. `src/components/auth/AuthProvider.tsx` — don't churn `user`/`session` on TOKEN_REFRESHED

- In the `onAuthStateChange` handler, treat `TOKEN_REFRESHED` (and any event where `currentSession?.user?.id` matches the current `user?.id`) as a no-op for React state.
  - Keep the session in a `useRef` so we still have the latest tokens for any code that asks.
  - Only call `setSession` / `setUser` when `currentSession.user.id` actually differs from the current user id, or on `SIGNED_IN` / `SIGNED_OUT` / `INITIAL_SESSION` where the identity legitimately changes.
- Same guard inside the `getSession()` initial resolve: if the resolved user id matches what we already have, just flip `isInitialized` / `loading` without replacing the user object.
- Keep `useMemo` value depending on `[user, session, loading]` — with the guard above it will now be referentially stable across token refreshes.

This single change stops the entire cascade for 95% of cases.

### 2. `src/pages/Schedule.tsx` — make tab state survive a stray remount

- Change the `useEffect([searchParams])` block so it only calls `setActiveTab` when the URL's `tab` value actually differs from the current `activeTab` (prevents needless re-renders when `searchParams` identity changes but content doesn't).
- Initialize `activeTab` from `sessionStorage` as a fallback:
  - `useState(() => searchParams.get('tab') || sessionStorage.getItem('schedule:activeTab') || 'schedule')`
  - In a `useEffect([activeTab])`, write the value back to `sessionStorage`.
- When the user changes tab via the `<Tabs onValueChange>`, also push it into the URL via `setSearchParams({ tab }, { replace: true })` so the URL and storage agree.

Result: even if some unrelated remount happens, the user stays on the tab they were on instead of snapping back to "Schedule".

### 3. `src/components/schedule/unified/PartnershipSelector.tsx` + `PartnershipRotationManager.tsx` — persist the open dialog so a remount doesn't lose it

- `PartnershipSelector`: persist `configDialogOpen` and the selected partnership id in `sessionStorage` (key e.g. `partnership-settings:open`). On mount, rehydrate. Clear when the user closes the dialog explicitly.
- `PartnershipRotationManager`: do the same for `showWorkspace` + `selectedRoster.id` and `showBuilder` + `selectedRoster?.id` (keys e.g. `roster-workspace:openRosterId`, `roster-builder:openRosterId`). On mount, if a roster id is stored, look it up from the freshly fetched `rosters` list and re-open the corresponding dialog.
- Do NOT persist `RosterBuilderDialog` form values — only the "which roster was being edited" pointer. The builder already refetches its own data from `rosterId`.

This is the belt-and-suspenders piece: even if a future code change reintroduces a remount, the user lands back where they were.

## Technical notes

- Token refresh on visibility change is Supabase JS default behavior; we don't disable it (we still need fresh tokens). We just stop translating it into React state churn.
- Guarding on `user.id` (not `===` on the user object) is the standard pattern — Supabase always hands back a fresh object even when nothing meaningful changed.
- `sessionStorage` (not `localStorage`) for dialog persistence so it doesn't bleed across browser sessions / users.
- No DB / RLS / migration changes. No new dependencies. All changes are frontend only.

## Out of scope

- The horizontal/vertical scroll behavior of `OffshoreRosterDayGrid` (already addressed in earlier turns).
- The duplicate `🚀 fetchScheduleEntries` logs in the console — separate React StrictMode / double-effect noise, unrelated to the dialog closing.
- Any change to roster persistence semantics (drafts, assignments, approvals).