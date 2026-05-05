## Goal

Short workdays (actual < target) should reduce the flex balance by the deficit, just like overtime increases it. Only accidental input should be guarded — the math should be honest.

## Changes

### 1. Remove the clamp — `src/lib/flexTimeUtils.ts`
In `calculateFlexTime`, replace `flexDelta: Math.max(0, flexDelta)` with `flexDelta` so a 6h day on an 8h target yields `-2:00` instead of `0`. FZA withdrawals continue to use their dedicated negative path. Update the inline comment accordingly.

### 2. Backfill existing rows — migration
Recompute `flextime_delta` for every `daily_time_entries` row where `entry_type != 'fza_withdrawal'` and `work_start_time`/`work_end_time` are set, using the same target-hours rule (Mon–Thu 8h, Fri 6h, weekend 0h) and the existing ≤6h no-break-deduction rule. This corrects the 4 AMT short days (and any others across all users) from 0 back to their true negative deltas.

### 3. Fix the in-app Net Summary card — `src/components/schedule/FlexTimeSummaryCard.tsx`
Right now the card adds a separate "Short workdays −5:30" line on top of `currentMonthDelta`, which is why AMT shows −16:45 while the Excel shows −11:15. Once short-day deltas live inside `flextime_delta` again, remove the standalone short-workdays subtraction line so it isn't double-counted. The card's monthly total then equals the sum of `flextime_delta` (FLEX earned + short-day deficits) plus FZA — matching the Excel report.

### 4. Optional UX guard (light)
Keep a non-blocking confirmation in `TimeEntryDialog` when a user saves a workday whose actual hours are more than 1h below target, e.g. *"You worked 6h today, target was 8h. This will reduce your flex balance by 2h. Continue, or record as FZA?"* — purely advisory, no behaviour change if confirmed.

### 5. Update saved memory rule
Update `mem://constraints/break-deduction-6-hours-or-less` (the related "no negative for short days" rule lives near it) and the Core index line so future sessions know: short days now produce negative deltas; only input ergonomics are protected, not the math.

## Expected result for AMT

- Initial: +10:15
- Dec 2025 earned: +1:30
- 2026 earned: +13:00
- 2026 short days: −5:30 (now counted)
- 2026 FZA: −36:00
- **Ending balance: −16:45** (matches in-app card; Excel report will need to follow the same rule and will also show −16:45 after re-export)

## Out of scope
- Initial-balance seeding logic
- FZA withdrawal flow
- Friday 6h target
