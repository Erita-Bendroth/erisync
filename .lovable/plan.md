## Offshore Roster Grid — Drag paint, Save & Close, Fill blanks with Day

All changes are scoped to `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx`. Auto-save behavior on each cell stays; we just add batching for drag and a visible Save & Close button that also fills blanks.

### 1. Drag across cells to paint multiple shifts

- Add local state: `isDragging`, `dragUserId` (drag is constrained to a single member row so we don't accidentally paint across people), and `dragDates: Set<string>`.
- On a cell's `onMouseDown` (left button) with a selected code: start drag, record the user + first date, paint that cell.
- On `onMouseEnter` while dragging and same `userId`: add date to the set and visually highlight (ring) — do NOT save yet.
- On window `mouseup`: commit the drag — call `applyShiftWithRecovery` once per date in order, then a single `replaceUserRange` for that user covering the affected min/max date range. This keeps saves batched (one DB write per drag) and respects the existing recovery painter.
- Right-click / context menu still clears a single cell (unchanged).
- Add `select-none` on the table so drag doesn't select text. Cursor changes to `cell` over assignable cells.
- Tooltip / helper line updated: "Left-click or drag = assign · Right-click = clear".

### 2. Save & Close button

- Add a header row inside the grid `Card` with a primary `Button` labelled **Save & Close** on the right.
- Behavior:
  1. Find the `D` (Day) code in `codes` (match by `code === "D"`, case-insensitive).
  2. For every member × every date in the visible range, if `byUser.get(member.id)?.get(date)` is empty, build a `DayAssignment` for that cell using the Day code (anchor, no recovery).
  3. Group the new blank-fills per user, merge with existing, and call `replaceUserRange(userId, startDate, endDate, merged)` once per affected user (parallelised with `Promise.all`).
  4. On success, toast "Roster saved" and call a new optional `onClose?: () => void` prop so the parent dialog can close. If `onClose` is not provided, just toast.
- If the `D` code doesn't exist, toast a warning ("No Day code in palette — blank days were not filled") and still close.

### 3. Parent wiring

- Find where `OffshoreRosterDayGrid` is rendered (inside the roster dialog shown in the screenshot) and pass `onClose={() => setOpen(false)}` (or the equivalent existing close handler). No other parent logic changes.

### Technical notes

- The painter `applyShiftWithRecovery` is reused as-is — drag just calls it iteratively on a working list before persisting.
- Blank-fill uses the Day code's `id` as `shift_code_id`, `is_anchor: true`, `recovery_for_code_id: null` so it behaves like a manual assignment and survives subsequent edits.
- All saves continue to go through `replaceUserRange`, which already strips `created_at` / `updated_at` (the prior fix), so no DB or hook changes are required.
- No migration, no schema changes.

### Files touched
- `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx` (drag handlers, Save & Close button, blank-fill logic, `onClose` prop)
- The dialog/parent that renders the grid (one-line prop addition)
