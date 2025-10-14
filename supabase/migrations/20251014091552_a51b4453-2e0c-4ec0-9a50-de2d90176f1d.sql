-- Update the create_default_schedule_with_holidays function to properly filter regional holidays
CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays(
    _user_id uuid,
    _team_id uuid,
    _start_date date,
    _end_date date,
    _created_by uuid,
    _country_code text DEFAULT NULL,
    _region_code text DEFAULT NULL
)
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
    user_region TEXT;
    is_holiday BOOLEAN;
BEGIN
    -- Input validation
    IF _user_id IS NULL OR _team_id IS NULL OR _start_date IS NULL OR _end_date IS NULL OR _created_by IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be null';
    END IF;
    
    IF _start_date > _end_date THEN
        RAISE EXCEPTION 'Start date cannot be after end date';
    END IF;
    
    -- Get user's country and region if not provided
    IF _country_code IS NULL OR _region_code IS NULL THEN
        SELECT country_code, region_code INTO user_country, user_region
        FROM public.profiles 
        WHERE user_id = _user_id;
        
        -- Use provided values or defaults
        user_country := COALESCE(_country_code, user_country, 'US');
        user_region := COALESCE(_region_code, user_region);
    ELSE
        user_country := _country_code;
        user_region := _region_code;
    END IF;

    current_date_var := _start_date;
    
    WHILE current_date_var <= _end_date LOOP
        -- Get day of week using ISO format (1=Monday, 7=Sunday)
        day_of_week := EXTRACT(ISODOW FROM current_date_var);
        
        -- ONLY create entries for Monday (1) through Friday (5) - NEVER weekends
        IF day_of_week BETWEEN 1 AND 5 THEN
            -- Check if this date is a public holiday for the user's country and region
            is_holiday := EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE date = current_date_var 
                AND country_code = user_country 
                AND is_public = true
                AND user_id IS NULL -- Only centrally managed holidays
                AND (
                    -- National holidays (no region specified)
                    region_code IS NULL
                    -- Regional holidays matching user's region (only for Germany)
                    OR (user_country = 'DE' AND region_code = user_region AND user_region IS NOT NULL)
                )
            );
            
            IF NOT is_holiday THEN
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