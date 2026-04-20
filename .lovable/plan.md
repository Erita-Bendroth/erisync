

## Diagnosis

The dev server shows the **last error was at 06:58:50, but compiles have been clean since 06:59:02** — the build is currently healthy. So the blank page at `/` is a **runtime crash**, not a build error. Three likely culprits, in order of probability:

### 1. `UnifiedDashboardBody` runtime crash
We exported a body component from `UnifiedDashboard.tsx` and mounted it inside the new "Team Overview" tab in `Dashboard.tsx`. If `UnifiedDashboardBody` was extracted incompletely (e.g. missing hooks, missing imports, refers to props the parent used to pass), the whole `Dashboard` page crashes — and since `Index.tsx` redirects authenticated users to `/dashboard`, the user lands on a blank screen.

### 2. `useScheduleEntries` hook regression
The new hook is `enabled: !!user?.id` AND requires either userIds or teamIds. In `Dashboard.tsx` we pass `userIds: user?.id ? [user.id] : []` — looks fine, but a typo or a missing `enabled` short-circuit could trigger an unhandled fetch error.

### 3. `Index.tsx` / route flow
If `/` redirects to `/dashboard` and `/dashboard` crashes, user sees blank. `Index.tsx` was not touched — but worth verifying.

## Fix plan (one pass, surgical)

1. **Read** `src/pages/UnifiedDashboard.tsx` end-to-end to confirm `UnifiedDashboardBody`:
   - Is exported correctly
   - Has all hooks/imports it needs
   - Doesn't reference variables that only existed in the original wrapper

2. **Read** `src/hooks/useScheduleEntries.ts` to confirm:
   - It returns `data` (not undefined) when disabled
   - Doesn't throw on empty `userIds`

3. **Add an Error Boundary** around `<UnifiedDashboardBody />` in the Team Overview tab so a crash in that subtree no longer takes down the whole `/dashboard` page. This guarantees the visible Dashboard renders even if Team Overview is broken.

4. **Fix the actual crash** in whichever of (1) or (2) is the root cause.

5. Verify by tailing dev-server log + opening `/dashboard` — confirm clean render.

### Rollback option
If the fix isn't immediate, the safest option is to revert the last AI message via the **History** view (restores everything to before the consolidation) and reapply changes one file at a time.

