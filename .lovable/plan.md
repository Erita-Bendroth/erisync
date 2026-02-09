

## Fix: FZA Withdrawal Should Override Bulk-Generated Schedule Entries

### Problem

When AMT records an FZA withdrawal on February 20th, the database trigger `sync_time_entry_to_schedule` tries to update the existing `schedule_entries` row, but it has a safety guard:

```sql
WHERE schedule_entries.notes LIKE '%[auto-sync]%'
```

Since the Feb 20 entry has notes starting with "Bulk generated", the UPDATE silently does nothing. The schedule entry remains as a normal shift.

While the client-side merge logic in ScheduleView should display the override, modifying the trigger to actually update the database is the correct fix -- it ensures every view (personal calendar, team schedule, exports, etc.) shows the correct status without relying on each component implementing its own merge logic.

### Solution

Update the `sync_time_entry_to_schedule` trigger function to **remove the `[auto-sync]` guard** on the `DO UPDATE` clause for unavailable types. When someone records sick leave, vacation, FZA, or a public holiday, it should always override whatever schedule entry exists for that date.

To preserve the ability to restore the original entry when the time entry is deleted, we will store the original notes in the updated entry.

### Technical Details

**Migration: Update `sync_time_entry_to_schedule` function**

Key change in the `ON CONFLICT DO UPDATE`:
- Remove the `WHERE schedule_entries.notes LIKE '%[auto-sync]%'` guard
- Always overwrite with unavailable status when an unavailable time entry is recorded
- On DELETE, restore the original schedule entry is not feasible, so just mark it back (or remove the auto-sync entry)

```sql
ON CONFLICT (user_id, team_id, date) 
DO UPDATE SET
  availability_status = 'unavailable',
  activity_type = 'out_of_office',
  shift_type = NULL,
  notes = '[auto-sync] ' || NEW.entry_type,
  updated_at = now();
-- No WHERE guard -- unavailable types always override
```

**One-time data fix for AMT's Feb 20:**

Update the existing schedule entry so it reflects the FZA withdrawal immediately:

```sql
UPDATE schedule_entries 
SET activity_type = 'out_of_office',
    availability_status = 'unavailable',
    shift_type = NULL,
    notes = '[auto-sync] fza_withdrawal',
    updated_at = now()
WHERE user_id = '4c6e0211-87d0-41c2-b3f4-5df8e974a4c0'
  AND date = '2026-02-20';
```

### What Changes

| Area | Current | Fixed |
|------|---------|-------|
| Trigger guard | Only overwrites entries with `[auto-sync]` in notes | Always overwrites for unavailable types (vacation, sick, FZA, public holiday) |
| AMT Feb 20 | Shows "Normal shift" in schedule | Shows "OOO / FZA" in schedule |
| Future FZA/sick/vacation entries | May not override bulk-generated shifts | Will always override, visible everywhere without client-side merge |

### Files / Changes

| Change | Type |
|--------|------|
| SQL migration: update `sync_time_entry_to_schedule` function | Database migration |
| SQL migration: fix AMT's Feb 20 entry | Database migration (one-time data fix) |
| No frontend changes needed | The ScheduleView merge logic remains as a safety net |

### Risk Assessment

- **Low risk**: The trigger only fires for unavailable types (vacation, sick_leave, public_holiday, fza_withdrawal). Work/home_office entries are unaffected.
- **Edge case**: If a user records FZA then deletes it, the original "Bulk generated" notes are lost. The DELETE branch already handles cleanup by removing `[auto-sync]` entries. Since the original shift data would be overwritten, we accept this trade-off -- the user would need to re-create the shift manually if they undo the FZA.
