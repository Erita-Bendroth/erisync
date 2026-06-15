## Goal
Make offshore day assignments behave exactly as configured: if a person is assigned **one E shift**, the next day must automatically become **WO** because E has `WO days after = 1`.

## What I will change
1. **Fix the recovery calculation to handle single-day blocks reliably**
   - Update the offshore recovery helper so it always treats one assigned E/L/N shift as a complete block and writes the configured WO day(s) immediately after it.
   - Keep the long-block logic for N shifts intact.

2. **Prevent auto-WO from being lost at the visible range edge**
   - The current save path filters assignments to the displayed start/end range. If the E is on the last visible day, the generated WO after it can be dropped.
   - Extend the save range enough to include recovery days after the selected shift.

3. **Make WO apply when assigning from either direction**
   - If a user assigns E after an existing E, recovery should move to after the full consecutive E block.
   - If a user assigns a standalone E, the very next day should become WO immediately.

4. **Verify with the exact scenario**
   - Test the helper behavior for: assign one E on a day → next day is WO.
   - Also verify two adjacent E shifts still put WO after the block, not between the E shifts.

## Technical details
- Main files involved:
  - `src/lib/offshorePattern.ts`
  - `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx`
  - possibly `src/hooks/useRosterDayAssignments.ts`
- No database schema changes planned.
- No change to the E configuration itself; your screenshot is correct: `after: 1` should already mean one WO after one E.