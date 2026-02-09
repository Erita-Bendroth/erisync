
-- 1. Update the sync_time_entry_to_schedule trigger function
-- Remove the [auto-sync] WHERE guard so unavailable types always override
CREATE OR REPLACE FUNCTION sync_time_entry_to_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_entry_type text;
  v_unavailable_types text[] := ARRAY['vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- On delete, remove auto-synced schedule entries
    DELETE FROM schedule_entries
    WHERE user_id = OLD.user_id
      AND date = OLD.entry_date
      AND notes LIKE '%[auto-sync]%';
    RETURN OLD;
  END IF;

  v_entry_type := NEW.entry_type;

  -- Only sync unavailable types
  IF NOT (v_entry_type = ANY(v_unavailable_types)) THEN
    RETURN NEW;
  END IF;

  -- Get the user's team(s)
  FOR v_team_id IN
    SELECT team_id FROM team_members WHERE user_id = NEW.user_id
  LOOP
    INSERT INTO schedule_entries (
      user_id, team_id, date, availability_status, activity_type,
      shift_type, notes, created_by, created_at, updated_at
    ) VALUES (
      NEW.user_id, v_team_id, NEW.entry_date, 'unavailable', 'out_of_office',
      NULL, '[auto-sync] ' || v_entry_type, NEW.user_id, now(), now()
    )
    ON CONFLICT (user_id, team_id, date)
    DO UPDATE SET
      availability_status = 'unavailable',
      activity_type = 'out_of_office',
      shift_type = NULL,
      notes = '[auto-sync] ' || v_entry_type,
      updated_at = now();
    -- No WHERE guard: unavailable types always override any existing entry
  END LOOP;

  RETURN NEW;
END;
$$;

-- 2. One-time data fix: Update AMT's Feb 20 schedule entry
UPDATE schedule_entries 
SET activity_type = 'out_of_office',
    availability_status = 'unavailable',
    shift_type = NULL,
    notes = '[auto-sync] fza_withdrawal',
    updated_at = now()
WHERE user_id = '4c6e0211-87d0-41c2-b3f4-5df8e974a4c0'
  AND date = '2026-02-20';
