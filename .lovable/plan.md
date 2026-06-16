## Two fixes

### 1. Public holiday → "Unavailable" in My Team's Availability

**File:** `src/components/schedule/TeamAvailabilityView.tsx`

Currently each cell only reflects `schedule_entries`. If no entry exists, the user is treated as "Available" (well, "-"), and when an entry exists with `availability_status='available'` we render a green check. On a public holiday like Fri Jun 19, ERBET shows up as Available even though it's a holiday for them.

Changes:
- After loading team members and their profiles, also fetch the country/region from `profiles` (already returned by `get_multiple_basic_profile_info`? if not, fall back to `holidayDetection.detectHolidays`).
- Call `detectHolidays(workDays, memberIds, teamIds[0])` to get a `holidayMap` of `dateStr → userId → HolidayInfo`.
- In the cell render:
  - If the user has **any work shift_type entry** (`early`/`late`/`night`/`normal` with `availability_status='available'`) on that day → behave exactly as today (E/L/N badge or green "Available"). A scheduled shift always wins, per the user's instruction "unless a shift scheduled".
  - Else if `holidayMap` flags that date as a public holiday (or personal holiday) for that user → render the red XCircle + "Unavailable" (with a small "Holiday" tooltip/label).
  - Else fall back to the existing logic (Available / Unavailable / "-").

This only changes the My Team's Availability view; it does not modify any schedule data.

### 2. Co-Planning calendar header/columns out of alignment beyond 1M

**Files:** `src/components/schedule/planning-partners/IntegratedPlanningCalendar.tsx`, `src/components/schedule/planning-partners/TeamSection.tsx`

Root cause: the day-header row is a `<div className="flex gap-2">` of small pill boxes with no fixed per-column width, while each `TeamSection` renders an inner `<table>` whose day cells use `min-w-[120px]`. Body cells are ~120px each; header pills are ~60px. At 3M/6M/1Y the body grows to 90/180/365 wide columns while the header stops after a handful of pills — visually the dates seem to disappear because the body extends far past where the header ends, and headers no longer line up with the columns below.

Changes:
- Give every day header pill an explicit fixed width matching the body cells (e.g. `min-w-[120px] w-[120px]`) inside `IntegratedPlanningCalendar`.
- Give the leading "Team / Member" label the same fixed width (`w-[200px]`) it already has — keep consistent.
- In `TeamSection`, keep `min-w-[120px]` on day `<td>`s but also add `w-[120px]` so the table column width is deterministic and matches the header.
- Wrap the header and the team sections in a shared horizontally-scrolling container so they scroll together (already the case via `overflow-x-auto` on the outer wrapper). Just need consistent widths so columns align across header and every team section.

No data-fetching or schema changes for this fix; purely layout.

### Out of scope

- Changing how holidays are stored or how shifts are scheduled.
- Changing the Co-Planning data model, RLS, or which entries are fetched.
