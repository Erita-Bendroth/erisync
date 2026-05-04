# Move Vacation Carryover Into Employee Settings

## Problem
The carryover editor currently lives only inside `UserTimeStatsDisplay`, which is rendered in the Team Management view (Teams tab). Regular employees do not have access to Teams ("Manager or Planner access required"), so they cannot set their own carryover.

## Solution
Add a self-service "Vacation Carryover" card to the **Settings** tab on `/schedule?tab=settings` (which every authenticated user can already access). The carryover dialog logic already exists in `UserTimeStatsDisplay`; we just need a small standalone settings card that reuses the existing `useUserTimeStats` hook + `updateCarryover` function.

## Changes

### 1. New component: `src/components/settings/VacationCarryoverSettings.tsx`
A small card scoped to the current user:
- Uses `useAuth()` to get current `user.id`.
- Uses `useUserTimeStats({ userIds: [user.id], year: currentYear })` to load the user's allowance + current carryover.
- Displays: current year, yearly allowance, carryover, total, used, remaining.
- "Edit carryover" button opens a Dialog with a numeric input (0–60 days).
- On save → calls `updateCarryover(user.id, value)` and toasts success.
- Friendly explanatory copy: "Enter any vacation days you carried over from {year-1}. These are added to your {year} allowance."

### 2. Wire it into the Settings tab
In `src/pages/Schedule.tsx` (around line 641, the `<TabsContent value="settings">` block), insert `<VacationCarryoverSettings />` between `UserProfileOverview` and `CountrySelector`.

### 3. Keep existing manager-side editor
The carryover field already added to `UserTimeStatsDisplay` (Edit Allowances dialog + inline "Edit carryover" link) stays as-is so managers can still edit on behalf of team members from the Teams tab.

## Out of scope
- No DB/RPC changes (already shipped in the previous migration).
- No changes to the Dashboard quick-actions panel.
- No carryover history/audit UI.

## Files
- **Create**: `src/components/settings/VacationCarryoverSettings.tsx`
- **Edit**: `src/pages/Schedule.tsx` (one import + one JSX line in settings tab)
