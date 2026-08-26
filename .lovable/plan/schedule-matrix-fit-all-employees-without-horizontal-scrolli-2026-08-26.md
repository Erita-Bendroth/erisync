# Schedule Matrix: Fit All Employees Without Horizontal Scrolling

## Problem
In the Schedule Matrix dialog, each employee column is a fixed ~90px wide. With a big team (e.g. 13+ people in Turbine Troubleshooting Offshore), the table overflows the dialog width and the user must scroll horizontally to see everyone.

## Changes

### 1. Auto-fit columns to the dialog width (`src/components/schedule/ScheduleMatrixDialog.tsx`)
- Change the table from fixed-width columns (`w-max`, `min-w-[90px]`) to a full-width layout (`w-full table-fixed`) so employee columns share the available width.
- Measure the dialog's scroll container; each employee column gets `(containerWidth - dateColumn - coverageColumn) / employeeCount`, with a floor of ~64px. If the team is so large that columns would drop below the floor, fall back to horizontal scrolling as today (no worse than current behavior).
- Shrink cell padding and font at tight widths so entries stay readable.

### 2. Compact rendering for entry chips
- At narrow column widths, entry chips keep the activity label but truncate gracefully (`truncate` already in place); times stay on their own line.
- The "+" placeholder for empty cells stays centered.

### 3. Keep sticky behavior
- Date column (left) and Coverage column (right) remain sticky; header row stays sticky on vertical scroll. Sticky offsets use the measured column widths so nothing overlaps.

## Technical details
- Use a `ResizeObserver` on the scroll container to recompute column width on dialog resize.
- No data-fetch changes; only layout/CSS in `ScheduleMatrixDialog.tsx`.

## Validation
- Open Matrix view with the Turbine Troubleshooting Offshore team (13 members): all 13 columns visible at once with no horizontal scrollbar at a typical desktop width.
- Small teams still get comfortably wide columns (capped, e.g. max 140px).
- Narrow fallback: on very small screens the table scrolls horizontally as before.
