Do I know what the issue is? Yes.

The current fix still depends on `position: sticky` inside a horizontally scrolling `<table>` inside a scrollable modal. In this layout, the browser can still treat the table/ancestor scrolling context in a way that lets the Member column scroll away. More `z-index` will not reliably solve it.

Plan:
1. Replace the offshore roster table layout with a split grid layout:
   - Left rail: Member names, outside the horizontal scroll area.
   - Right pane: date cells, horizontally scrollable.
   - Both panes stay vertically aligned in the same vertical scrolling area.
2. Keep the current roster assignment behavior unchanged:
   - Click/drag to assign selected code.
   - Right-click to clear.
   - Existing auto-save and Save & Close behavior unchanged.
3. Keep headers usable:
   - Member header remains visible.
   - Date header remains at the top of the grid while vertical scrolling.
4. Apply the same modal scroll containment in both places that render this grid, so the dialog itself does not compete with the roster grid scrolling.
5. Verify in the running preview by horizontally scrolling the roster grid and confirming the Member column remains visible.

Files to update:
- `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx`
- `src/components/schedule/partnerships/RosterBuilderDialog.tsx`
- `src/components/schedule/partnerships/PartnershipWorkspace.tsx`

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>