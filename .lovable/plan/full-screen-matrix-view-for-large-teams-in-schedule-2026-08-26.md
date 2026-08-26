# Full-screen matrix view for large teams in Schedule

## Goal
Make large teams viewable at a glance by adding a button in Schedule that opens the current weekly selection in a full-screen pop-up, transposed like the Excel reference: dates down the left, employee names across the top, and a per-day coverage summary on the right.

## Changes

### 1. New component: ScheduleMatrixDialog
- A full-screen dialog opened from the Schedule toolbar (button next to Weekly/Monthly, e.g. "Matrix view").
- Layout, matching the Excel screenshot:
  - **Left column:** dates (day name + date), one row per day of the selected week.
  - **Top row:** employee names/initials as column headers.
  - **Right column:** per-day coverage summary — for each date, show how many people are on each shift (e.g. Early 3 · Late 2 · Night 1), styled like a legend row.
- **Coverage warnings:** for teams with a minimum staffing requirement (team capacity config / partnership shift requirements, e.g. min 1 on E/L/N for Turbine Troubleshooting Offshore), any day below the minimum shows a red warning badge with the shift and shortfall count.
- **Complete scheduling per cell:** when an employee has multiple entries on one day (e.g. training 08:00-10:00 plus regular work 10:00-16:00), render them stacked vertically in chronological order inside the cell, each with its own color/label — not collapsed into one.
- Reuse the existing schedule data and permission filters already loaded by ScheduleView (no new data access, same team visibility rules).
- Header row and date column stay sticky so big teams remain navigable while scrolling.
- Clicking a cell opens the same schedule-entry detail/edit flow as the normal grid where permissions allow.

### 2. Entry point
- Add a "Matrix view" button in the Schedule header area, visible when weekly view is active and more than one employee is shown.

## Technical details
- New file `src/components/schedule/ScheduleMatrixDialog.tsx`; launched from `ScheduleView.tsx` around the Weekly/Monthly toggle.
- Data comes from the already-fetched schedule entries array in ScheduleView (grouped by date + employee); coverage counts reuse the shift_requirements/team_capacity config hooks already used for the coverage banner.
- Cell stacking sorts entries by start time (from notes/time definition), falling back to creation order.
- Minimums: offshore partnership teams use E/L/N shift requirements; other teams use team capacity `min_staff_required` on work entries.

## Validation
- Open Matrix view with a large team (e.g. Turbine Troubleshooting Offshore): all employees appear as columns, week dates as rows.
- A day with training 08-10 + work 10-16 shows two stacked blocks in order.
- A day missing an Early shift shows a red warning in the right-hand summary.
- Non-managers see the same matrix but without edit access to other people's entries.
