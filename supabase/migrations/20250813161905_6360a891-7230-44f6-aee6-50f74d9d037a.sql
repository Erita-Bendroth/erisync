-- Phase 1: Fix Schedule Data Access Control - Critical RLS Policy Updates

-- Drop the overly permissive team member policy
DROP POLICY IF EXISTS "Team members can view availability only" ON public.schedule_entries;

-- Create a secure policy for team members to only see their own team's schedules
CREATE POLICY "Team members can view their team schedules only" 
ON public.schedule_entries 
FOR SELECT 
USING (
  has_role(auth.uid(), 'teammember'::app_role) 
  AND team_id IN (SELECT get_user_teams(auth.uid()))
);

-- Phase 2: Database Function Security Hardening

-- Fix handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Fix has_role function with proper search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Fix is_manager_of_team function with proper search_path
CREATE OR REPLACE FUNCTION public.is_manager_of_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE user_id = _user_id AND team_id = _team_id AND is_manager = true
    )
$$;

-- Fix get_user_teams function with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_teams(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

-- Fix update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix create_default_schedule_with_holidays function with proper search_path and input validation
CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays(_user_id uuid, _team_id uuid, _start_date date, _end_date date, _created_by uuid, _country_code text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
        -- Get day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
        day_of_week := EXTRACT(DOW FROM current_date_var);
        
        -- Only create entries for Monday (2) through Friday (6)
        IF day_of_week BETWEEN 2 AND 6 THEN
            -- Check if this date is a public holiday for the user's country
            IF NOT EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE date = current_date_var 
                AND country_code = user_country 
                AND is_public = true
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
                RETURNING CASE WHEN xmax = 0 THEN 1 ELSE 0 END INTO created_count;
                
                -- If we get here, either an insert or update happened
                IF created_count = 1 THEN
                    created_count := created_count + 1;
                ELSE
                    updated_count := updated_count + 1;
                END IF;
            ELSE
                excluded_count := excluded_count + 1;
            END IF;
        END IF;
        
        current_date_var := current_date_var + INTERVAL '1 day';
    END LOOP;
    
    RETURN created_count + updated_count;
END;
$$;

-- Fix create_team_default_schedules_with_holidays function with proper search_path
CREATE OR REPLACE FUNCTION public.create_team_default_schedules_with_holidays(_team_id uuid, _start_date date, _end_date date, _created_by uuid)
RETURNS TABLE(user_id uuid, shifts_created integer, country_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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