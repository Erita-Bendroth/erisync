## Root cause

The Rotation Schedule builder always renders the **weekly** grid (`RosterWeekGrid`), even when offshore mode is on. Weekly cells assign one shift per whole week, so a "single E" is actually 7 days of E and there's no slot for a WO recovery day. The day-by-day offshore grid (`OffshoreRosterDayGrid`) with the auto-WO recovery logic exists, but it is not wired into the builder — the offshore banner just tells the user to "open the day-by-day grid" with no link.

## Fix

In `src/components/schedule/partnerships/RosterBuilderDialog.tsx`, the **Weekly Assignments** tab will switch automatically based on partnership type:

- **Offshore partnership** (e.g. Turbine Troubleshooting Offshore): render `OffshoreRosterDayGrid` for the date range `startDate` → `startDate + cycleLength weeks - 1 day`. Each cell is one day; clicking a single `E` now correctly inserts the `WO` the next day per the shift code's `1 WO after` rule (which already works in `applyShiftWithRecovery`).
- **Non-offshore partnership**: keep the existing `RosterWeekGrid` exactly as today.

The tab will also be renamed to **Day-by-day Assignments** when in offshore mode, and the banner text updated to reflect that the grid is shown inline (instead of "open it from the partnership list").

No DB changes. No changes to the recovery-rule logic itself — it is already correct; it just wasn't being reached.