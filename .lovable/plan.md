# Fit the full team in Schedule Matrix

## Goal
Ensure the Schedule Matrix always shows every selected team member at once without horizontal scrolling, including large teams such as the current 28-member example.

## Changes
- Replace the current 64px employee-column floor and overflow fallback with proportional whole-matrix scaling based on the dialog’s measured width.
- Scale all matrix parts together: date and coverage columns, employee columns, header initials, names, cell padding, activity text, and coverage badges.
- Preserve fixed table geometry and sticky date/header/coverage behavior while allowing columns to become compact enough to fit the complete team.
- Keep full employee and schedule details accessible through existing hover titles and cell interactions even when the visible text is compact.
- Remove horizontal overflow for the matrix while retaining vertical scrolling for the 4-week, month, and year ranges.

## Validation
- Verify the 28-member team fits within the matrix dialog with no horizontal scrollbar.
- Verify smaller teams remain readable and do not become unnecessarily enlarged.
- Check 4 Weeks, Month, and Year modes, including sticky headers and coverage, at the current desktop viewport.
- Confirm the project builds without errors.

## Technical details
- Calculate a scale factor from the matrix’s preferred width versus its available container width, capped at normal size.
- Apply that factor consistently to column widths and compact sizing classes/styles rather than retaining a hard minimum that forces overflow.
- Keep a sensible lower visual limit for text where possible, but prioritize the explicit requirement that all users fit on one page.
