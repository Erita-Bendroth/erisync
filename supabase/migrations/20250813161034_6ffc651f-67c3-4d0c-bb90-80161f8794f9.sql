-- Update the create_default_schedule_with_holidays function to handle duplicates better
CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays(_user_id uuid, _team_id uuid, _start_date date, _end_date date, _created_by uuid, _country_code text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_date_var DATE;
    day_of_week INTEGER;
    excluded_count INTEGER := 0;
    created_count INTEGER := 0;
    updated_count INTEGER := 0;
    user_country TEXT;
BEGIN
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
                RAISE NOTICE 'Excluded holiday: % for country %', current_date_var, user_country;
            END IF;
        END IF;
        
        current_date_var := current_date_var + INTERVAL '1 day';
    END LOOP;
    
    RAISE NOTICE 'Created % new shifts, updated % existing shifts, excluded % holidays for user % in country %', 
                 created_count, updated_count, excluded_count, _user_id, user_country;
    
    RETURN created_count + updated_count;
END;
$function$;