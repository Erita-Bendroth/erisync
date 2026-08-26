# Make the Schedule Matrix readable while still fitting large teams

## Goal
Keep all members visible in the Schedule Matrix without sideways scrolling, but stop shrinking the grid so aggressively that initials and cells become unusably tiny.

## Changes
- Use the full available dialog width instead of letting the fitted table collapse into a narrow area with blank space to the right.
- Rebalance column widths so employee columns get priority over the date and coverage columns.
- Keep initials readable by showing a compact initials-only header at large team sizes, with full names kept in hover titles.
- Make the coverage column compact for large teams, so it does not steal space from employee columns.
- Add responsive density thresholds:
  - normal teams: names + initials, comfortable sizing
  - large teams: readable initials, tighter cells
  - very large teams: initials-only headers, compact coverage, all members still visible
- Preserve the current vertical scrolling for 4 Weeks, Month, and Year views.

## Validation
- Verify the 28-member team fits across the matrix with no horizontal scrolling.
- Verify the table fills the dialog width instead of leaving a large empty area on the right.
- Verify initials remain visible and readable in the 28-member view.
- Verify smaller teams still show names and remain readable.
- Confirm 4 Weeks, Month, and Year modes still render with sticky date/header/coverage behavior.

## Technical details
- Replace the single proportional shrink factor with a layout calculation that distributes available width after reserving compact date/coverage columns.
- Derive employee column width from the remaining space: `(availableWidth - dateWidth - coverageWidth) / employeeCount`.
- Switch header rendering based on computed employee column width, rather than scaling everything down uniformly.
- Keep full employee identity and entry details available via existing title/hover behavior.
