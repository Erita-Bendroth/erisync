## Plan

1. Add a lightweight debug logger that only runs when explicitly enabled
   - Gate all new logs behind a session flag like `sessionStorage.setItem('schedule-debug-remounts', '1')`.
   - Include timestamps, render instance IDs, mount/unmount events, dependency snapshots, and current URL/tab visibility.
   - This keeps production console noise low unless we are actively diagnosing the issue.

2. Instrument the remount chain from parent to child
   - `App.tsx`: log app/router render and route-level mount context.
   - `Layout.tsx`: log mount/unmount, `loading`, `hasUser`, and when it returns the loading/auth redirect branches.
   - `Schedule.tsx`: log exact mount/unmount, renders, active tab, `searchParams`, `user.id`, `contextLoading`, `userRoles`, and `teams.length`.
   - `ScheduleView.tsx` and `UnifiedTeamScheduler.tsx`: log mount/unmount and key effects that can cascade reloads.

3. Instrument the likely state triggers
   - `useCurrentUserContext.ts`: log every `loading` transition, `fetchAll()` start/end, role/team/profile result sizes, and whether the `user.id` dependency changed.
   - `Schedule.tsx`: log when the `useEffect([user, contextLoading])` runs, why it runs, and when `fetchTeams()` starts/finishes/sets teams.
   - `ScheduleView.tsx`: log the static-data and dynamic-data effects tied to `contextLoading`, roles, selected teams, and view mode.
   - `useScheduleAccessControl.ts`: log role/team permission fetch start/end and resulting role/team set sizes.
   - Add `visibilitychange`, `focus`, `blur`, `pagehide`, and `pageshow` listeners for diagnostics only.

4. Add temporary isolation toggles requested by you
   - `schedule-debug-freeze-context-loading=1`: make `useCurrentUserContext` keep `loading` stable after first successful load so we can validate whether `contextLoading` flips are responsible.
   - `schedule-debug-disable-schedule-user-context-effect=1`: skip the `Schedule.tsx` `useEffect([user, contextLoading])` that calls `fetchTeams()`.
   - Log clearly when either isolation mode is active.

5. Validate in the browser with Playwright
   - Restore the Supabase session, navigate to `/schedule?tab=unified-scheduler`, enable debug flags, open Partnership Settings and a roster workspace.
   - Wait long enough to cover the ~5 minute window and also simulate tab background/foreground using page visibility where possible.
   - Capture console output around the reset and identify the last dependency/effect/state transition before any `Schedule.tsx` unmount.
   - Repeat with each isolation toggle to prove whether the issue disappears when `contextLoading` or the Schedule effect is held stable.

6. Report the proven root cause before applying any permanent behavior change
   - Summarize which component unmounted first, which dependency changed immediately before it, and whether parent routing/layout remounted.
   - If the culprit is confirmed, then make a separate focused fix instead of guessing at auth again.