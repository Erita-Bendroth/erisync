# Schedule Matrix: Minimum 4-Week View

## Goal
The Schedule Matrix dialog currently defaults to a single week. Change it so the matrix shows at least 4 weeks starting from the current week, keeping longer-range options.

## Changes (src/components/schedule/ScheduleMatrixDialog.tsx)

1. **Range modes**: Replace `week | month | year` with `4weeks | month | year`.
2. **Default**: `rangeMode` initialises to `'4weeks'`.
3. **Year range anchored to current week**: When `year` is selected, the range no longer spans Jan 1–Dec 31 of the anchor year. Instead it starts at the Monday of the current week (same `4weeks` anchor) and spans ~52 weeks forward via `addDays(startOfWeek(anchor), 364)`. This makes the year view open at the current week instead of jumping back to January.
3. **Day range**: Compute 28 consecutive days starting from the Monday of the currently viewed week (`workDays[0]`, or today as fallback), using `startOfWeek(anchor, { weekStartsOn: 1 })` + `addDays(..., 27)`. All 7 days of each week included (weekends shown).
4. **Data fetching**: The existing paginated fetch effect already handles non-week ranges — extend its condition so `4weeks` also self-fetches from `schedule_entries` (28 days × team members can exceed the week-only prop data).
5. **Range label**: Show `MMM d – MMM d, yyyy` for the 4-week span.
6. **Toggle buttons**: Rename the segmented control to `4 Weeks / Month / Year` with `4 Weeks` active by default.
7. Coverage column, sticky headers, cell click behavior, and offshore E/L/N requirements stay unchanged — `useOffshoreScheduleCoverage` already accepts the dynamic start/end dates.

## Technical notes
- Uses existing date-fns imports plus `startOfWeek`/`addDays`.
- Loading spinner logic reused for the 4-week fetch.
- No other files touched; the `Matrix` button wiring in ScheduleView.tsx is unaffected.
