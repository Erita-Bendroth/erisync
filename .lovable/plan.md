## Stop the roster grid from "reloading" and dropping input

### Root cause

`OffshoreRosterDayGrid` saves through `useRosterDayAssignments.replaceUserRange`, which:

1. `DELETE` all of the user's rows in the visible date range
2. `INSERT` the new rows
3. `await load()` — refetch every assignment in the roster and `setAssignments(...)`

That refetch (~hundreds of ms) is what the user is seeing as the "page reloading" flash. Worse, every paint reads `byUser` from React state, and React state only updates after `load()` finishes. So when two paints happen close together (drag commit + a second click, or two quick cells), the second paint uses a **stale** `existing` list, then `replaceUserRange` deletes the range and re-inserts only the stale-plus-new rows — wiping the first paint. That is "the input I have done disappears."

### Fix

Make local state the source of truth between saves, and stop the destructive refetch on every save.

1. **Optimistic local state in `useRosterDayAssignments.ts`**
   - In `replaceUserRange`, before hitting the DB:
     - Compute `optimisticNext = [...assignments.filter(a => !(a.user_id === userId && a.work_date >= fromDate && a.work_date <= toDate)), ...next.filter(in range)]`
     - `setAssignments(optimisticNext)` immediately.
   - Then run the DELETE + INSERT in the background. On error, revert to the previous snapshot and toast.
   - **Remove the `await load()` at the end.** It causes the visible flash and the stale-snapshot race. Keep `reload` exported for explicit refresh (initial mount only).

2. **Serialize saves per user with a small in-flight queue**
   - Add a `pendingByUser = useRef<Map<string, Promise<void>>>()`. `replaceUserRange` chains its work onto `pendingByUser.get(userId) ?? Promise.resolve()` and stores the new tail. This guarantees the second click for a user always sees the first click's committed state and prevents the DELETE-then-stale-INSERT wipe even if React state hasn't propagated yet.

3. **Grid uses fresh assignments via a ref**
   - In `OffshoreRosterDayGrid.tsx`, keep an `assignmentsRef = useRef(assignments)` updated in a `useEffect`. Both `paintDates` (drag commit) and `handleSaveAndClose` read existing rows from `assignmentsRef.current` instead of the closure'd `byUser`, so they always operate on the latest optimistic state regardless of render timing.

4. **No more full-grid flicker**
   - With (1) the grid only re-renders for the rows that actually changed, and there's no DB round-trip between the click and the UI updating. The dialog stays open; nothing remounts.

### Out of scope
- No DB schema changes, no migration.
- Drag-paint, Save & Close, and the "fill blanks with D" behaviour are unchanged — only the save plumbing.

### Files touched
- `src/hooks/useRosterDayAssignments.ts` — optimistic update, drop `await load()` after writes, per-user save queue, error rollback.
- `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx` — read existing rows from a ref so consecutive paints don't lose data.
