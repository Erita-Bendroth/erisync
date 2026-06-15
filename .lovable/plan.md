## Changes

### 1. Per-shift staffing requirements match offshore shifts
In `ShiftRequirements.tsx`, detect whether the partnership is offshore (team name contains "Offshore", reusing `isOffshoreByTeamNames`). When offshore, render four shift cards instead of the current three:

- Early Shift — Morning coverage
- Late Shift — Afternoon coverage
- Night Shift — Overnight coverage
- Normal Day — Standard working day

Non-offshore partnerships keep today's list (Late / Early / Weekend).

The underlying `partnership_shift_requirements` table already keys by `shift_type`, so the offshore values (`early`, `late`, `night`, `normal`) save/load with no schema change.

### 2. Remove "Shift Pattern" button from Team Scheduler toolbar
In `src/components/schedule/unified/PartnershipSelector.tsx`, remove the cyan **Shift Pattern** button (and its dialog mount) shown next to the ⚙️ gear in the screenshot. The Offshore badge and the gear button stay. Shift-pattern configuration remains reachable from the Rotation Rosters tab inside Partnership Settings.

No DB migration required.