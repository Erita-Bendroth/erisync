## Goal
Reduce visual clutter in the Schedule Overview header. Today managers see 7+ buttons in one row (Add Entry, Request Swap, Generate Bulk, Assign Substitute, Export Schedule, 2-week Summary, Weekly Duty Coverage, plus Manage Partnerships for admins). We'll keep the most-used actions visible and group the rest under a single "More actions" dropdown.

## New layout

Visible buttons (in order):
1. **Add Entry** — primary action (kept as solid button)
2. **Request Swap** — kept (frequent daily action)
3. **More actions ▾** — dropdown menu containing everything else

Inside "More actions" dropdown, grouped with separators:

- **Bulk & assignments**
  - Generate Bulk
  - Assign Substitute
- **Communication**
  - Export Schedule
  - Send 2-week Summary
  - Send Weekly Duty Coverage
- **Admin** (admin only)
  - Manage Partnerships

Each item keeps its existing icon (Users, UserCheck, Download, Mail) on the left for quick scanning. Permission gating stays exactly the same — items only appear in the dropdown if the user currently sees the button.

The dialogs (`notifyOpen`, `showDutyCoverageModal`, `showBulkWizard`, `partnershipDialogOpen`, `substituteDialogOpen`) stay where they are; only their *triggers* move into the dropdown.

## Files to change
- `src/pages/Schedule.tsx` — replace the toolbar block at lines ~416–594 with: primary buttons + a `DropdownMenu` (`@/components/ui/dropdown-menu`, already used elsewhere). Keep the existing Dialog components mounted (open state controlled via dropdown items).

## Out of scope
- No changes to ScheduleView's secondary row ("Time Off / Show Requests / Edit Multiple / Team / Manage Favorites / date nav"). User flagged the *top* toolbar specifically; we can do that row in a follow-up if desired.
- No changes to permissions, dialogs, or any underlying behavior.

## Result
Manager view goes from ~7 toolbar buttons to **3** (Add Entry, Request Swap, More actions ▾), matching the "uncluttered" goal while keeping every action one click away.
