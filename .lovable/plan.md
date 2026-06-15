## Problem

The offshore shift-pattern system I built earlier is implemented but nearly invisible:

- **Pattern tab** lives inside `PartnershipWorkspace`, which only opens when a user clicks **Edit** on an *already-saved* roster.
- **Creating a new roster** goes through `RosterBuilderDialog`, which has no offshore toggle, no shift-code editor, and no day-grain grid.
- There is no entry point at the **partnership level** to define E / L / N / WO codes before any roster exists.
- The teams list and shift codes therefore appear "missing" even though the data layer is wired up.

## Goal

Make the offshore pattern reachable from the natural places a planner already looks: the partnership card itself, and the new-roster flow.

## Changes

### 1. Partnership-level "Shift Pattern" button
In `PartnershipRotationManager.tsx`, add a **Shift Pattern** button on each partnership header (next to "+ New Roster"). It opens a lightweight dialog hosting `OffshorePatternPanel` for that partnership — no roster required. This is where the planner:
- toggles **Offshore mode** on/off for the partnership
- sees the seeded E / L / N / D / WO codes
- edits colours, labels, and recovery rules
- sees the list of member teams in the partnership (currently the panel shows codes only — add a small "Teams in this partnership" header so the user can confirm scope)

### 2. Offshore awareness in the new-roster flow
In `RosterBuilderDialog`, when the partnership has `offshore_mode = true`:
- Show a banner: *"This partnership uses offshore shift patterns (E/L/N/WO). The day-grain grid will be used after the roster is created."*
- Hide / disable the legacy weekly grid so planners don't double-enter data.
- On save, jump straight into `PartnershipWorkspace` on the **Build** tab so the day grid is immediately editable.

### 3. Edit menu surfacing
On each roster row in `PartnershipRotationManager`, rename the existing **Edit** action's tab default:
- if the roster is offshore → workspace opens on **Build** (day grid) as today
- always make **Pattern** the second tab (already is) and add a small "Offshore" badge on the roster card when `offshore_mode` is on, so users can see at a glance which rosters are governed by E/L/N rules.

### 4. Empty-state hint
When the partnership has no rosters yet, show a one-line hint under the empty state:
*"Tip: configure your shift codes first via **Shift Pattern** ↑"*

## Files to change

- `src/components/schedule/partnerships/PartnershipRotationManager.tsx` — add Shift Pattern button + dialog, offshore badge on rows, empty-state hint
- `src/components/schedule/partnerships/RosterBuilderDialog.tsx` — read partnership offshore flag, show banner, suppress weekly grid when offshore
- `src/components/schedule/partnerships/OffshorePatternPanel.tsx` — add "Teams in this partnership" header section
- (no DB migration; schema from the previous step is sufficient)

## Out of scope (still pending from earlier)

- Writing day assignments into `schedule_entries` on activation
- "Repeat cycle" projection button
- Country-specific E/L/N → actual time mapping

Let me know if you want any of those bundled in, or I can ship the visibility fixes first and tackle activation next.
