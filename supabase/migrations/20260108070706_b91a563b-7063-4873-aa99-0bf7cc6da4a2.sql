-- Function to sync daily_time_entries to schedule_entries for team visibility
CREATE OR REPLACE FUNCTION public.sync_time_entry_to_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_record RECORD;
  v_availability_status availability_status;
  v_activity_type activity_type;
  v_notes TEXT;
BEGIN
  -- Handle DELETE: remove synced schedule entries
  IF TG_OP = 'DELETE' THEN
    DELETE FROM schedule_entries
    WHERE user_id = OLD.user_id
      AND date = OLD.entry_date
      AND activity_type IN ('work'::activity_type, 'working_from_home'::activity_type, 'out_of_office'::activity_type, 'training'::activity_type)
      AND notes LIKE '%[auto-sync]%';
    RETURN OLD;
  END IF;

  CASE NEW.entry_type
    WHEN 'home_office' THEN
      v_availability_status := 'available'::availability_status;
      v_activity_type := 'working_from_home'::activity_type;
      v_notes := CASE 
        WHEN NEW.work_start_time IS NOT NULL AND NEW.work_end_time IS NOT NULL 
        THEN 'WFH ' || to_char(NEW.work_start_time, 'HH24:MI') || '-' || to_char(NEW.work_end_time, 'HH24:MI') || ' [auto-sync]'
        ELSE 'WFH [auto-sync]'
      END;
    WHEN 'work' THEN
      v_availability_status := 'available'::availability_status;
      v_activity_type := 'work'::activity_type;
      v_notes := CASE 
        WHEN NEW.work_start_time IS NOT NULL AND NEW.work_end_time IS NOT NULL 
        THEN 'Work ' || to_char(NEW.work_start_time, 'HH24:MI') || '-' || to_char(NEW.work_end_time, 'HH24:MI') || ' [auto-sync]'
        ELSE 'Work [auto-sync]'
      END;
    WHEN 'training' THEN
      v_availability_status := 'available'::availability_status;
      v_activity_type := 'training'::activity_type;
      v_notes := 'Training [auto-sync]';
    WHEN 'team_meeting' THEN
      v_availability_status := 'available'::availability_status;
      v_activity_type := 'work'::activity_type;
      v_notes := 'Team Meeting [auto-sync]';
    WHEN 'vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal' THEN
      v_availability_status := 'unavailable'::availability_status;
      v_activity_type := 'out_of_office'::activity_type;
      v_notes := initcap(replace(NEW.entry_type, '_', ' ')) || ' [auto-sync]';
    ELSE
      RETURN NEW;
  END CASE;

  FOR team_record IN 
    SELECT team_id FROM team_members WHERE user_id = NEW.user_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM schedule_entries 
      WHERE user_id = NEW.user_id 
        AND date = NEW.entry_date 
        AND team_id = team_record.team_id
        AND activity_type = 'hotline_support'::activity_type
    ) THEN
      INSERT INTO schedule_entries (user_id, date, team_id, availability_status, activity_type, notes, shift_type, created_by)
      VALUES (NEW.user_id, NEW.entry_date, team_record.team_id, v_availability_status, v_activity_type, v_notes, 'normal', NEW.user_id)
      ON CONFLICT (user_id, date, team_id) 
      DO UPDATE SET 
        availability_status = EXCLUDED.availability_status,
        activity_type = EXCLUDED.activity_type,
        notes = EXCLUDED.notes,
        updated_at = now()
      WHERE schedule_entries.notes LIKE '%[auto-sync]%' 
         OR schedule_entries.activity_type IN ('work'::activity_type, 'working_from_home'::activity_type, 'out_of_office'::activity_type, 'training'::activity_type);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Backfill historical entries (last 12 months)
DO $$
DECLARE
  entry_record RECORD;
  team_record RECORD;
  v_availability_status availability_status;
  v_activity_type activity_type;
  v_notes TEXT;
BEGIN
  FOR entry_record IN 
    SELECT * FROM daily_time_entries 
    WHERE entry_date >= CURRENT_DATE - INTERVAL '12 months'
      AND entry_type IN ('work', 'home_office', 'training', 'team_meeting', 'vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal')
  LOOP
    CASE entry_record.entry_type
      WHEN 'home_office' THEN
        v_availability_status := 'available'::availability_status;
        v_activity_type := 'working_from_home'::activity_type;
        v_notes := CASE 
          WHEN entry_record.work_start_time IS NOT NULL AND entry_record.work_end_time IS NOT NULL 
          THEN 'WFH ' || to_char(entry_record.work_start_time, 'HH24:MI') || '-' || to_char(entry_record.work_end_time, 'HH24:MI') || ' [auto-sync]'
          ELSE 'WFH [auto-sync]'
        END;
      WHEN 'work' THEN
        v_availability_status := 'available'::availability_status;
        v_activity_type := 'work'::activity_type;
        v_notes := CASE 
          WHEN entry_record.work_start_time IS NOT NULL AND entry_record.work_end_time IS NOT NULL 
          THEN 'Work ' || to_char(entry_record.work_start_time, 'HH24:MI') || '-' || to_char(entry_record.work_end_time, 'HH24:MI') || ' [auto-sync]'
          ELSE 'Work [auto-sync]'
        END;
      WHEN 'training' THEN
        v_availability_status := 'available'::availability_status;
        v_activity_type := 'training'::activity_type;
        v_notes := 'Training [auto-sync]';
      WHEN 'team_meeting' THEN
        v_availability_status := 'available'::availability_status;
        v_activity_type := 'work'::activity_type;
        v_notes := 'Team Meeting [auto-sync]';
      WHEN 'vacation', 'sick_leave', 'public_holiday', 'fza_withdrawal' THEN
        v_availability_status := 'unavailable'::availability_status;
        v_activity_type := 'out_of_office'::activity_type;
        v_notes := initcap(replace(entry_record.entry_type, '_', ' ')) || ' [auto-sync]';
      ELSE
        CONTINUE;
    END CASE;

    FOR team_record IN 
      SELECT team_id FROM team_members WHERE user_id = entry_record.user_id
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM schedule_entries 
        WHERE user_id = entry_record.user_id 
          AND date = entry_record.entry_date 
          AND team_id = team_record.team_id
          AND activity_type = 'hotline_support'::activity_type
      ) THEN
        INSERT INTO schedule_entries (user_id, date, team_id, availability_status, activity_type, notes, shift_type, created_by)
        VALUES (entry_record.user_id, entry_record.entry_date, team_record.team_id, v_availability_status, v_activity_type, v_notes, 'normal', entry_record.user_id)
        ON CONFLICT (user_id, date, team_id) 
        DO UPDATE SET 
          availability_status = EXCLUDED.availability_status,
          activity_type = EXCLUDED.activity_type,
          notes = EXCLUDED.notes,
          updated_at = now()
        WHERE schedule_entries.notes LIKE '%[auto-sync]%' 
           OR schedule_entries.activity_type IN ('work'::activity_type, 'working_from_home'::activity_type, 'out_of_office'::activity_type, 'training'::activity_type)
           OR schedule_entries.notes IS NULL;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;