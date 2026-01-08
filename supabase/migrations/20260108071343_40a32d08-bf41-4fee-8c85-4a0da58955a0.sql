-- Add missing triggers on daily_time_entries
DROP TRIGGER IF EXISTS sync_time_entry_trigger ON daily_time_entries;
DROP TRIGGER IF EXISTS sync_time_entry_delete_trigger ON daily_time_entries;

-- Create INSERT/UPDATE trigger
CREATE TRIGGER sync_time_entry_trigger
AFTER INSERT OR UPDATE ON daily_time_entries
FOR EACH ROW
EXECUTE FUNCTION sync_time_entry_to_schedule();

-- Create DELETE trigger  
CREATE TRIGGER sync_time_entry_delete_trigger
AFTER DELETE ON daily_time_entries
FOR EACH ROW
EXECUTE FUNCTION sync_time_entry_to_schedule();

-- Re-run backfill for missing entries (last 12 months)
INSERT INTO schedule_entries (user_id, team_id, date, shift_type, availability_status, activity_type, notes, created_by)
SELECT DISTINCT
  dte.user_id,
  tm.team_id,
  dte.entry_date,
  'normal'::shift_type,
  (CASE 
    WHEN dte.entry_type IN ('work', 'home_office', 'training', 'team_meeting') THEN 'available'
    ELSE 'unavailable'
  END)::availability_status,
  (CASE 
    WHEN dte.entry_type = 'home_office' THEN 'working_from_home'
    WHEN dte.entry_type = 'training' THEN 'training'
    WHEN dte.entry_type IN ('vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal') THEN 'out_of_office'
    ELSE 'work'
  END)::activity_type,
  '[auto-sync]',
  dte.user_id
FROM daily_time_entries dte
JOIN team_members tm ON tm.user_id = dte.user_id
WHERE dte.entry_date >= CURRENT_DATE - INTERVAL '12 months'
  AND dte.entry_type IN ('work', 'home_office', 'vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal', 'training', 'team_meeting')
  AND NOT EXISTS (
    SELECT 1 FROM schedule_entries se
    WHERE se.user_id = dte.user_id
      AND se.date = dte.entry_date
      AND se.team_id = tm.team_id
  );