Do I know what the issue is? Yes.

The screenshots show the whole Partnership Settings dialog content is horizontally scrolling. That means the member column is not anchored to the visible dialog; it is part of the same oversized content surface being shifted left/right. The date scrollbar must belong only to the date grid area, while the member column must sit outside that horizontal scroll area.

Plan:
1. Fix the parent dialog overflow in `PartnershipCapacityConfig`.
   - Prevent the Partnership Settings dialog body from becoming the horizontal scroller.
   - Keep vertical scrolling on the dialog only.
   - Add `min-w-0` to the tabs/content chain so children can shrink instead of forcing page-level horizontal overflow.

2. Replace the roster schedule layout in `OffshoreRosterDayGrid` with a strict two-column grid.
   - Column 1: fixed member column, never horizontally scrollable.
   - Column 2: date grid only, with `overflow-x-auto`.
   - The horizontal scrollbar will move only dates/cells, not members.

3. Keep vertical scrolling aligned.
   - Use one vertical scroll area for the grid body.
   - Sync/structure member rows and date rows with identical fixed heights.
   - Keep the date header aligned with the date cells.

4. Remove the current failure mode.
   - No sticky-left dependency inside a dialog-level horizontal scroller.
   - No parent horizontal scroll stealing the movement.
   - No clipped member names when the date grid is scrolled.

5. Verify against the exact screenshot behavior.
   - In Partnership Settings → Rotation Rosters → Schedule, scroll dates horizontally.
   - Confirm `Member` and all member initials remain fully visible at the left.
   - Confirm dates move independently to later dates.
   - Confirm cells remain clickable after horizontal scrolling.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
  <presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>