I’ll fix the Partnership Settings → Rotation Roster → Schedule grid by changing only the roster schedule layout and the dialog overflow that blocks it.

Plan:
1. Rework `OffshoreRosterDayGrid` so the member column is outside the horizontal date scroller.
   - Left column: fixed-width member names/initials, always visible.
   - Right side: date header and assignment cells in one horizontally scrollable pane.

2. Keep vertical row alignment reliable.
   - Use matching fixed row heights for the member list and each date row.
   - Put vertical scrolling on the shared grid area so names and date cells move together vertically.

3. Make horizontal date scrolling always reachable.
   - Remove the nested/suppressed overflow setup that hides the date scrollbar.
   - Ensure the date area has a real minimum width based on the number of dates.
   - Keep the horizontal scrollbar at the schedule grid, not on the entire dialog/page.

4. Preserve existing roster behavior.
   - Shift palette selection stays unchanged.
   - Click/drag assignment stays unchanged.
   - Right-click clear stays unchanged.
   - Save & Close fill behavior stays unchanged.

5. Verify in the live preview.
   - Open Partnership Settings → Rotation Roster → Schedule.
   - Confirm dates scroll horizontally.
   - Confirm member names/initials remain visible while dates scroll.
   - Confirm cells remain clickable after horizontal scrolling.