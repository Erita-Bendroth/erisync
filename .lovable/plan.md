## Problem

I added the **Shift Pattern** entry point inside *Partnership Rotation Rosters* (Schedule → Team Scheduler → Partnership Rotation tab → roster list). But you're working on the **Team Scheduler** screen itself (the one in your screenshot with Partnership dropdown, coverage warnings, and the weekly grid) — and the pattern controls aren't reachable from there. That's why it feels missing.

## Goal

Put **Shift Pattern** one click away from the Partnership dropdown on the Team Scheduler — exactly where the ⚙️ capacity gear already lives.

## Changes

### 1. `PartnershipSelector.tsx` (Team Scheduler header)
Add a second small icon button next to the existing ⚙️ gear:
- Icon: `Waves` (cyan)
- Label/tooltip: *"Configure offshore shift pattern (E / L / N / WO)"*
- Opens a dialog that hosts `OffshorePatternPanel` for the currently selected partnership
- Shows a small "Offshore" badge inline next to the partnership name when offshore mode is on for that partnership, so you can see at a glance which partnerships use it

### 2. Dialog wrapper (inline in `PartnershipSelector.tsx`)
Reuses the existing `OffshorePatternPanel` (toggle offshore mode, seed E/L/N/D/WO preset, edit codes, recovery rules, teams list).
No new component file needed.

### 3. Keep the Partnership Rotation entry too
The "Shift Pattern" button I already added to `PartnershipRotationManager.tsx` stays — same dialog reachable from two natural locations.

## Files to change

- `src/components/schedule/unified/PartnershipSelector.tsx` — add Waves button, offshore badge, dialog mount
- (no DB changes, no new components)

## Why not a new tab on the Team Scheduler

The Team Scheduler page is already busy (mode tabs, view selector, coverage panels, grid). A single icon next to the gear matches the existing pattern (capacity config is also a one-icon entry point) and keeps the toolbar quiet.

Ready to implement on approval.
