-- Fix remaining functions without explicit search_path
-- These are the functions that still need search_path set

CREATE OR REPLACE FUNCTION public.log_profile_access_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when profiles are accessed by managers/admins
  IF auth.uid() != NEW.user_id AND (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  ) THEN
    PERFORM log_profile_access(NEW.user_id, 'SELECT');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_schedule_availability(_start date, _end date)
RETURNS TABLE(user_id uuid, team_id uuid, date date, availability_status availability_status)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT se.user_id, se.team_id, se.date,
    CASE WHEN se.activity_type = 'work' THEN 'available'::availability_status
         ELSE 'unavailable'::availability_status
    END AS availability_status
  FROM public.schedule_entries se
  WHERE se.date >= _start AND se.date <= _end
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'planner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays(_user_id uuid, _team_id uuid, _start_date date, _end_date date, _created_by uuid, _country_code text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_date_var DATE;
    day_of_week INTEGER;
    excluded_count INTEGER := 0;
    created_count INTEGER := 0;
    updated_count INTEGER := 0;
    user_country TEXT;
BEGIN
    -- Input validation
    IF _user_id IS NULL OR _team_id IS NULL OR _start_date IS NULL OR _end_date IS NULL OR _created_by IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be null';
    END IF;
    
    IF _start_date > _end_date THEN
        RAISE EXCEPTION 'Start date cannot be after end date';
    END IF;
    
    -- Get user's country if not provided
    IF _country_code IS NULL THEN
        SELECT country_code INTO user_country 
        FROM public.profiles 
        WHERE user_id = _user_id;
        
        -- Default to 'US' if no country set
        IF user_country IS NULL THEN
            user_country := 'US';
        END IF;
    ELSE
        user_country := _country_code;
    END IF;

    current_date_var := _start_date;
    
    WHILE current_date_var <= _end_date LOOP
        -- Get day of week using ISO format (1=Monday, 7=Sunday)
        day_of_week := EXTRACT(ISODOW FROM current_date_var);
        
        -- ONLY create entries for Monday (1) through Friday (5) - NEVER weekends
        IF day_of_week BETWEEN 1 AND 5 THEN
            -- Check if this date is a public holiday for the user's country
            IF NOT EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE date = current_date_var 
                AND country_code = user_country 
                AND is_public = true
                AND (user_id IS NULL OR user_id = _user_id)
            ) THEN
                -- Use INSERT ... ON CONFLICT to handle duplicates gracefully
                INSERT INTO public.schedule_entries (
                    user_id,
                    team_id,
                    date,
                    shift_type,
                    activity_type,
                    availability_status,
                    notes,
                    created_by
                ) VALUES (
                    _user_id,
                    _team_id,
                    current_date_var,
                    'normal',
                    'work',
                    'available',
                    'Auto-generated shift (08:00-16:30)',
                    _created_by
                )
                ON CONFLICT (user_id, date, team_id) 
                DO UPDATE SET
                    shift_type = EXCLUDED.shift_type,
                    activity_type = EXCLUDED.activity_type,
                    availability_status = EXCLUDED.availability_status,
                    notes = EXCLUDED.notes,
                    updated_at = now()
                WHERE schedule_entries.notes LIKE '%Auto-generated%'; -- Only update auto-generated entries
                
                created_count := created_count + 1;
            ELSE
                excluded_count := excluded_count + 1;
            END IF;
        END IF;
        
        current_date_var := current_date_var + INTERVAL '1 day';
    END LOOP;
    
    RETURN created_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_weekly_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Log the manual trigger
  INSERT INTO public.cron_job_logs (job_name, status)
  VALUES ('weekly-schedule-notifications', 'running');
  
  -- Call the edge function
  SELECT net.http_post(
    url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/weekly-schedule-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '", "source": "manual"}')::jsonb
  ) INTO result;
  
  -- Update the log with the result
  UPDATE public.cron_job_logs 
  SET status = 'success', response_data = result
  WHERE job_name = 'weekly-schedule-notifications' 
  AND executed_at = (
    SELECT MAX(executed_at) 
    FROM public.cron_job_logs 
    WHERE job_name = 'weekly-schedule-notifications'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Update the log with the error
  UPDATE public.cron_job_logs 
  SET status = 'error', error_message = SQLERRM
  WHERE job_name = 'weekly-schedule-notifications' 
  AND executed_at = (
    SELECT MAX(executed_at) 
    FROM public.cron_job_logs 
    WHERE job_name = 'weekly-schedule-notifications'
  );
  
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS TABLE(jobname text, schedule text, active boolean, jobid bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'cron'
AS $$
  SELECT 
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.jobid
  FROM cron.job j
  WHERE j.jobname = 'weekly-schedule-notifications';
$$;

CREATE OR REPLACE FUNCTION public.import_holidays_for_year(_country_code text, _year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Input validation
    IF _country_code IS NULL OR _year IS NULL THEN
        RAISE EXCEPTION 'Country code and year cannot be null';
    END IF;
    
    IF _year < 1900 OR _year > 2100 THEN
        RAISE EXCEPTION 'Year must be between 1900 and 2100';
    END IF;
    
    -- This will be called by the edge function
    -- Just a placeholder for now with proper validation
    RAISE NOTICE 'Holiday import function called for % in %', _country_code, _year;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_team_default_schedules_with_holidays(_team_id uuid, _start_date date, _end_date date, _created_by uuid)
RETURNS TABLE(user_id uuid, shifts_created integer, country_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    member_record RECORD;
BEGIN
    -- Input validation
    IF _team_id IS NULL OR _start_date IS NULL OR _end_date IS NULL OR _created_by IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be null';
    END IF;
    
    FOR member_record IN 
        SELECT tm.user_id, COALESCE(p.country_code, 'US') as country_code
        FROM public.team_members tm
        LEFT JOIN public.profiles p ON tm.user_id = p.user_id
        WHERE tm.team_id = _team_id
    LOOP
        SELECT member_record.user_id, 
               public.create_default_schedule_with_holidays(
                   member_record.user_id,
                   _team_id,
                   _start_date,
                   _end_date,
                   _created_by,
                   member_record.country_code
               ),
               member_record.country_code
        INTO user_id, shifts_created, country_code;
        
        RETURN NEXT;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_password(_email text, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_exists boolean;
BEGIN
  -- This function will be used to verify current password before allowing changes
  -- We'll implement the actual verification in the edge function for security
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_temporary_password(_user_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  temp_password TEXT := 'VestasTemp2025!';
BEGIN
  -- This function will be called by the edge function to verify the password
  -- The actual password verification will happen in the edge function
  -- This function just stores the temporary password for comparison
  RETURN _password = temp_password;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_profile_access(_profile_user_id uuid, _access_type text DEFAULT 'SELECT'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the access attempt
  INSERT INTO public.profile_access_log (
    accessed_by,
    profile_user_id,
    access_type,
    access_time
  ) VALUES (
    auth.uid(),
    _profile_user_id,
    _access_type,
    now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_manager_team_access(_manager_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_access BOOLEAN := false;
BEGIN
  -- Check if manager has access to target user's profile
  SELECT EXISTS(
    SELECT 1 
    FROM public.team_members tm1
    INNER JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _manager_id 
    AND tm1.is_manager = true
    AND tm2.user_id = _target_user_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;