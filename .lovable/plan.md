# Show entry notes in the Schedule Matrix

Notes are already fetched for every matrix entry but never displayed. Add them to each cell so a person's comments show under their shift.

## What changes

- In each matrix cell, under the activity label and shift times, show the entry's note when one exists.
- Notes render in a smaller, slightly dimmed line, wrapped to at most 2 lines with ellipsis so row heights stay predictable.
- In dense/very-dense layouts (large teams where names and times are already hidden), the note collapses to a small dot/asterisk marker instead of text, so columns stay readable.
- The cell tooltip is extended to include the full note text, so nothing is lost when truncated.

## Technical notes

Single file: `src/components/schedule/ScheduleMatrixDialog.tsx`.
- `notes` is already selected in the paginated `schedule_entries` query and present on `ScheduleEntry`.
- Inside the per-entry block, add a note element gated on `entry.notes?.trim()`, using `line-clamp-2`, `break-words`, and the existing `cellFontSize`/`cellPaddingX` scaling.
- Extend the existing `title` string to append the note.

No database, query, or business-logic changes.
