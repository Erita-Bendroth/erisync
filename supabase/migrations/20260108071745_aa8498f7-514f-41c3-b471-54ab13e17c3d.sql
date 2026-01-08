-- 1. Delete all auto-synced schedule_entries for work/home_office/training types
-- These were creating duplicates since ScheduleView already displays from daily_time_entries
DELETE FROM schedule_entries 
WHERE notes LIKE '%[auto-sync]%'
  AND activity_type IN ('work', 'working_from_home', 'training');

-- 2. Update the trigger function to ONLY sync unavailable types
-- Work/home_office are already displayed from daily_time_entries directly
CREATE OR REPLACE FUNCTION sync_time_entry_to_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_team_id uuid;
  v_activity_type activity_type;
BEGIN
  -- Handle DELETE: remove any synced schedule entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM schedule_entries
    WHERE user_id = OLD.user_id
      AND date = OLD.entry_date
      AND notes LIKE '%[auto-sync]%';
    RETURN OLD;
  END IF;

  -- Only sync unavailable types - work/home_office are displayed from daily_time_entries
  IF NEW.entry_type NOT IN ('vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal') THEN
    -- Not an unavailable type - remove any existing auto-synced entry and skip
    DELETE FROM schedule_entries
    WHERE user_id = NEW.user_id
      AND date = NEW.entry_date
      AND notes LIKE '%[auto-sync]%';
    RETURN NEW;
  END IF;

  -- Map entry_type to activity_type for unavailable types
  v_activity_type := 'out_of_office';

  -- Get a team_id for this user
  SELECT team_id INTO v_team_id
  FROM team_members
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- If user has no team, skip
  IF v_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert schedule entry for unavailable types only
  INSERT INTO schedule_entries (
    user_id, team_id, date, shift_type, availability_status, activity_type, notes, created_by
  ) VALUES (
    NEW.user_id,
    v_team_id,
    NEW.entry_date,
    'normal',
    'unavailable',
    v_activity_type,
    '[auto-sync] ' || NEW.entry_type,
    NEW.user_id
  )
  ON CONFLICT (user_id, team_id, date) 
  DO UPDATE SET
    availability_status = 'unavailable',
    activity_type = v_activity_type,
    notes = '[auto-sync] ' || NEW.entry_type,
    updated_at = now()
  WHERE schedule_entries.notes LIKE '%[auto-sync]%';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;