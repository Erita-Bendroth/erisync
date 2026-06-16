## Fix roster grid alignment + add month context

Both issues live in `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx`. The grid is currently split into two independently-scrolling containers (member column + date grid) with manual scroll-sync. That sync drifts whenever the date scroller's horizontal scrollbar reserves space the member scroller doesn't, and there is no month label anywhere.

### 1. Row alignment — single scroll container, sticky first column

Restructure the grid so member names and day cells live in the **same** scroll container and the **same** row element. That removes scroll-sync drift entirely and guarantees vertical alignment.

- Remove `memberScrollerRef`, `dateScrollerRef`, `syncMemberScroll`, `handleMemberWheel`.
- Wrap everything in one `div` with `max-h-[60vh] overflow-auto`.
- Inner content width = `160px (member col) + dates.length * 40px`.
- Header is one flex row, body rows are flex rows containing:
  - a `w-40 sticky left-0 z-10 bg-background border-r` member-name cell,
  - followed by the day cells.
- All rows (header + body) get an explicit fixed height via inline `style={{ height: 36 }}` (body) and `48` (header rows) so nothing is content-driven. Use `box-border` and consistent `border-b` so borders don't change row height.
- Header rows use `sticky top-0 z-20`; the member header cell uses `sticky top-0 left-0 z-30` so it stays pinned in both axes.

### 2. Month context — month header row spanning each month's columns

Above the existing day-of-week / day-number header, add a second sticky header row that groups consecutive dates by month.

- Precompute month groups from `dates`:
  ```ts
  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    for (const d of dates) {
      const label = format(parseISO(d), "MMMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.count += 1;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [dates]);
  ```
- Render the month row as flex cells with `width: count * 40px`, `text-xs font-semibold`, centered, `border-r border-b bg-muted/40`, sticky `top-0`. The day header becomes sticky `top-6` (or whatever the month-row height is) so both stick while scrolling.
- Add a left border on the **first** day cell of each new month inside the body rows (`borderLeft: idx>0 && isFirstOfMonth ? '2px solid hsl(var(--border))' : undefined`) so the month boundary is visible while scrolling vertically too.
- Member column header spans both header rows (`h-[calc(theme(...))]`) — simplest: give it `height: 24 + 48` and `sticky top-0 left-0`.

### Technical notes

- Keep all existing handlers (`startDrag`, `extendDrag`, `clearCell`, `paintDates`, `handleSaveAndClose`) unchanged — only the JSX layout and a couple of refs go.
- Keep the weekend `bg-muted` tint; combine with the new month-boundary left border.
- No changes to data hooks (`useRosterDayAssignments`, `usePartnershipShiftCodes`) or to `offshorePattern.ts`.
- Verify visually with Playwright against `/schedule?tab=unified-scheduler` → Partnership Settings → open roster, screenshot the grid, confirm: (a) each member row's cells line up with its name on the left, (b) "June 2026" / "July 2026" headers appear and a divider shows where the month changes.
