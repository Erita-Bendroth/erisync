Do I know what the issue is? Yes.

The rotation roster grid currently puts vertical scrolling on the whole grid row and horizontal scrolling only inside the date pane. That makes the horizontal date scrollbar easy to clip/hide inside the dialog, and the earlier sticky/flex changes are fighting each other. The result is exactly what you’re seeing: the members may stay visible, but you can’t reliably scroll across all dates and keep assigning cells.

Plan:
1. Rework only `OffshoreRosterDayGrid.tsx` so the roster editor has one bounded grid viewport with:
   - a fixed-width Member column
   - a horizontally scrollable date area
   - a visible bottom horizontal scrollbar
   - no horizontal scrolling on the dialog itself
2. Use a CSS grid layout instead of mixed sticky/table/flex behavior:
   ```text
   [ fixed member rail ][ scrollable date grid ]
   ```
   The member rail remains outside the horizontal scroller, so it never moves when dates scroll.
3. Keep date cells and member rows locked to the same row height so vertical scrolling remains aligned.
4. Remove the `overflow-x-hidden`/nested overflow combination where it blocks access to the date scrollbar; keep overflow constrained only where it belongs.
5. Preserve all existing roster behavior: selecting shift codes, click/drag assignment, right-click clear, recovery auto-fill, and Save & Close.
6. After implementation, verify in the live preview that:
   - the member column stays visible
   - the dates scroll horizontally through the full roster range
   - cells remain clickable/assignable after horizontal scrolling
   - the dialog does not gain a second page-level horizontal scroll

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>