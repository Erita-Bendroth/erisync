

## Plan: C — Standardize Data Fetching (Phase 1)

Migrate the highest-impact components from ad-hoc `supabase.from('schedule_entries')` queries to the shared `useScheduleEntries` hook. Same data, same shape, shared cache.

### Targets (Phase 1 only)

1. **`src/pages/Dashboard.tsx`** — fetches today's schedule for current user.
2. **`src/pages/UnifiedDashboard.tsx`** — fetches multi-team week of entries.
3. **`src/components/schedule/MonthlyScheduleView.tsx`** — fetches month of entries for team.
4. **`src/components/schedule/PersonalMonthlyCalendar.tsx`** — fetches month of entries for current user.

(Phases 2 & 3 deferred until these are verified.)

### Migration recipe (per file)

```ts
// REMOVE
const [entries, setEntries] = useState<any[]>([]);
useEffect(() => {
  supabase.from('schedule_entries').select('*')
    .gte('date', start).lte('date', end)
    .in('user_id', userIds)
    .then(({ data }) => setEntries(data ?? []));
}, [userIds, start, end]);

// REPLACE WITH
const { data: entries = [], isLoading } = useScheduleEntries({
  userIds, startDate: start, endDate: end,
  includeProfiles: true, // only if the old query joined profiles
});
```

### Cache-invalidation wiring (small, important)

For the new shared cache to refresh after edits, the existing **mutation paths** (shift create/edit/delete in `SchedulerGrid`, `EditScheduleModal`, vacation approval, swap approval) need one line added:

```ts
queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
```

I'll add this to the 3-4 mutation sites that already use `queryClient`. Sites that don't have a `queryClient` reference will be left alone for this pass — the migrated views will still refresh on the standard `staleTime` window, just not instantly. Cleanup pass later.

### Safety guarantees

- **No schema, RLS, or edge-function changes.**
- **No deletions** — old realtime subscriptions and refetch triggers in each file are preserved (they just become redundant; harmless).
- **One file at a time** — each migration is independently revertable.
- **`includeProfiles` / `includeTeams` flags** in `useScheduleEntries` already cover the join shapes the old code used. I'll verify per-file before swapping.
- **Build verified** with `npx tsc --noEmit` after each file.

### Files to edit

- `src/pages/Dashboard.tsx`
- `src/pages/UnifiedDashboard.tsx`
- `src/components/schedule/MonthlyScheduleView.tsx`
- `src/components/schedule/PersonalMonthlyCalendar.tsx`
- 3-4 mutation sites — add `invalidateQueries(['schedule-entries'])` (TBD after grep)

### Out of scope

- Phase 2/3 components (`TeamAvailabilityView`, `CoverageOverview`, Analytics, etc.).
- Migrating holiday queries to `useHolidayQuery` (separate pass — same recipe, different hook).
- Removing legacy realtime subscriptions (cleanup pass after Phase 3).

