I understand the exact issue now: in Partnership Settings → Rotation Rosters → Build, the horizontal scrollbar is still scrolling the whole roster grid/dialog, so the member column moves off-screen.

The likely cause is that the date grid is inside a flex row but the horizontally scrollable pane is missing `min-w-0`. Because of that, the wide date strip forces the parent/dialog to become horizontally scrollable instead of only the date pane. When you use the bottom scrollbar, the entire grid shifts left, including the member names.

Plan:

1. Fix `OffshoreRosterDayGrid.tsx`
   - Keep the member list as a fixed left rail.
   - Force the date pane to be the only horizontal scroll area with `min-w-0 overflow-x-auto`.
   - Prevent the outer card/dialog content from becoming horizontally scrollable with `overflow-hidden` on the grid frame.
   - Keep vertical scrolling shared between member rows and date rows so names stay aligned with cells.
   - Preserve all existing roster editing behavior: click, drag, right-click clear, recovery auto-fill, and Save & Close.

2. Tighten the roster dialog containers
   - Update the Rotation Roster dialog surfaces that host this grid so they do not create a second horizontal scrollbar.
   - Keep the dialog vertically scrollable where needed, but stop horizontal overflow from moving the fixed member rail.

3. Verify the exact scenario
   - Open the Partnership Settings → Rotation Rosters → Build surface.
   - Horizontally scroll across the date columns.
   - Confirm member names remain visible while dates/cells move.
   - Confirm vertical scrolling still keeps member names aligned with their rows.