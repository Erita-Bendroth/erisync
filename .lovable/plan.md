Make TimeEntryDialog scrollable and soften the break warning so the Save button is always reachable.

## Changes to `src/components/schedule/TimeEntryDialog.tsx`

1. **Scrollable dialog**
   - `<DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">`
   - Wrap `<DialogHeader>` in a `px-6 pt-6` container (pinned top).
   - Wrap the middle `<div className="space-y-4">` form area in `<div className="overflow-y-auto flex-1 px-6">` so it scrolls.
   - Wrap `<DialogFooter>` in `px-6 pb-6 pt-4 border-t` (pinned bottom, always visible).

2. **Soften break warning**
   - Change the break-validation `<Alert variant="destructive">` to `<Alert className="border-amber-500/50 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-600">`.
   - Append " You can still save this entry." to the message.
   - Keep the daily-limit alert as `destructive` (real over-limit case).
   - Save button stays enabled exactly as today (`disabled={saving || !hasValidTimes || !hasValidFzaHours}`) — break never blocks save.

## Verification (preview at 827×611, as FISIL)

- Open a weekday's time entry.
- Set 06:00–16:30, break 30 min.
- Confirm Save button visible without page scroll, form area scrolls internally.
- Click Save → entry persists, `flextime_delta = +2:00`, FlexTime card updates to +2:00 this month.
- Re-open entry → values round-trip correctly.

No formula, validation logic, DB, or RLS changes. Only `TimeEntryDialog.tsx` is touched.