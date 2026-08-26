# Schedule Matrix: Fix Blank Name Headers + Add Year View

## Problem 1 — No names/initials in the header
The matrix header calls `renderEmployeeName()`, but that helper returns `null` for users whose `last_name` is empty (initials-only users) — in the main weekly grid their initials appear in a separate avatar bubble next to the name, which the matrix header doesn't render. Result: blank column headers.

## Problem 2 — Only one week is visible
The dialog only receives the current week's entries (`scheduleEntries` covers the visible week), so longer ranges need their own data loading.

## Changes

### 1. Fix the header (`ScheduleMatrixDialog.tsx`)
Render each column header like the main grid: a small rounded initials bubble (using `employee.initials`) plus the full name from `renderEmployeeName` when available, so initials-only users always show something.

### 2. Add a range selector (Week / Month / Year)
- Toggle in the dialog header: **Week** (current behavior), **Month** (all days of the current month), **Year** (all days of the current year).
- Dates remain rows on the left; the table body scrolls vertically inside the dialog (header row stays sticky).

### 3. Fetch data for longer ranges
- When Month or Year is selected, the dialog fetches `schedule_entries` itself for the selected teams/employees across that range, using paginated queries (same 1000-row paging pattern as the offshore coverage hook) so nothing is truncated.
- The coverage column (`useOffshoreScheduleCoverage` / team minimums) is fed the same extended range so E/L/N warnings stay correct for the whole period.
- Show a small loading indicator while the extended range loads.

### Files touched
- `src/components/schedule/ScheduleMatrixDialog.tsx` — header fix, range selector, self-fetching for month/year
- No changes needed in `ScheduleView.tsx` (props stay the same)
