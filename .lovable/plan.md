

## Fix: FZA Withdrawal Not Showing in Personal Calendar

### Problem

User AMT recorded a FlexTime Withdrawal (FZA) of 6 hours on February 20, 2026. The time entry exists in `daily_time_entries`, but the Personal Monthly Calendar still shows "Normal shift 08:00-16:30".

**Root cause**: Two issues combine:

1. **Database trigger cannot overwrite**: The `sync_time_entry_to_schedule` trigger tries to upsert into `schedule_entries`, but it has a safety guard: `WHERE schedule_entries.notes LIKE '%[auto-sync]%'`. Since Feb 20 already has a bulk-generated schedule entry (notes start with "Bulk generated"), the trigger's UPDATE does nothing.

2. **PersonalMonthlyCalendar has no merge logic**: Unlike `ScheduleView` and `UnifiedTeamScheduler` (which both fetch `daily_time_entries` for unavailable types and merge them as overrides), the `PersonalMonthlyCalendar` component only queries `schedule_entries` directly. It never checks `daily_time_entries`, so even though the FZA entry exists, it is invisible in this view.

### Solution

Add the same time-entry merge pattern to `PersonalMonthlyCalendar` that already exists in `ScheduleView` and `UnifiedTeamScheduler`.

### What Changes

| Area | Current | Fixed |
|------|---------|-------|
| PersonalMonthlyCalendar data fetch | Only reads `schedule_entries` | Also reads `daily_time_entries` for unavailable types and merges them as overrides |
| Feb 20 display for AMT | "Normal shift 08:00-16:30" | "FZA" / "Out of Office" (reflecting the withdrawal) |

### Technical Details

**File: `src/components/schedule/PersonalMonthlyCalendar.tsx`**

In the `fetchScheduleData` function (around line 143), after fetching schedule entries:

1. Add a second query to fetch `daily_time_entries` for the same user and date range, filtered to unavailable types (`public_holiday`, `sick_leave`, `vacation`, `fza_withdrawal`).

2. Build a time-entry overrides map (keyed by date), creating synthetic schedule entry objects with `activity_type: 'out_of_office'` and `availability_status: 'unavailable'`.

3. Merge: filter out any schedule entries that have a matching time entry override for the same date, then add the overrides.

```
// After fetching schedule_entries (line 152):

// Fetch daily_time_entries for unavailable types to merge
const unavailableTypes = ['public_holiday', 'sick_leave', 'vacation', 'fza_withdrawal'];
const { data: timeEntries } = await supabase
  .from('daily_time_entries')
  .select('id, entry_date, entry_type, comment')
  .eq('user_id', user.id)
  .in('entry_type', unavailableTypes)
  .gte('entry_date', format(startDate, 'yyyy-MM-dd'))
  .lte('entry_date', format(endDate, 'yyyy-MM-dd'));

// Build overrides map
let mergedEntries = data || [];
if (timeEntries && timeEntries.length > 0) {
  const overrides = new Map();
  for (const te of timeEntries) {
    let notes = '';
    if (te.entry_type === 'public_holiday') notes = `Public Holiday: ${te.comment || 'Holiday'}`;
    else if (te.entry_type === 'sick_leave') notes = `Sick Leave: ${te.comment || ''}`.trim();
    else if (te.entry_type === 'vacation') notes = `Vacation: ${te.comment || ''}`.trim();
    else if (te.entry_type === 'fza_withdrawal') notes = `FZA: ${te.comment || ''}`.trim();

    overrides.set(te.entry_date, {
      id: `time-entry-${te.id}`,
      date: te.entry_date,
      shift_type: null,
      activity_type: 'out_of_office',
      availability_status: 'unavailable',
      notes,
    });
  }

  // Remove schedule entries that have overrides, then add overrides
  mergedEntries = mergedEntries.filter(e => !overrides.has(e.date));
  mergedEntries = [...mergedEntries, ...Array.from(overrides.values())];
}

setScheduleEntries(mergedEntries);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/schedule/PersonalMonthlyCalendar.tsx` | Add time entry fetch + merge logic in `fetchScheduleData` |

### Expected Result

- AMT's Personal Monthly Calendar for Feb 20 shows "OOO" or "FZA" instead of "Normal shift 08:00-16:30"
- All other unavailable types (sick leave, vacation, public holiday) also correctly override any pre-existing schedule entries
- No changes to other views (ScheduleView and UnifiedTeamScheduler already handle this)
