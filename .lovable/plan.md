## Keep the Member column visible while scrolling the roster grid

### Issue
On wide rosters the table scrolls horizontally inside the dialog, but the left-hand `Member` column scrolls off with the rest. The column is already marked `sticky left-0`, so two things are breaking it:

1. **`border-collapse` on the table** — Chromium/Safari don't reliably honour `position: sticky` on `<th>`/`<td>` when the table uses `border-collapse: collapse`. Cells with background colours (the painted E/L/N/WO cells) end up rendering on top.
2. **No `z-index`** on the sticky cells — even when sticky works, sibling coloured cells paint over the member name as they scroll under it.

### Fix (scoped to `OffshoreRosterDayGrid.tsx`)

- Switch the table to `border-separate border-spacing-0` (visually identical, sticky-safe).
- Add `z-20` to the sticky member-name `<td>` and `<th>` so they paint above the scrolling cells.
- Make the date header row sticky vertically too (`sticky top-0 z-10`, bg `bg-background`) so headers don't disappear when the dialog itself scrolls — and give the top-left `Member` header `z-30` so it stays above both axes.
- Keep `bg-background` on sticky cells, and add `border-r` / `border-b` utility classes so removing `border-collapse` doesn't change the visual borders.
- Ensure the scroll container is `<CardContent className="p-0 overflow-auto max-h-[60vh]">` so vertical scrolling is contained within the grid (rather than the outer dialog), which makes the sticky header reliably anchor to the grid.

### Out of scope
- No changes to drag/save logic, palette, or data fetching.
- No DB changes.

### Files touched
- `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx`
