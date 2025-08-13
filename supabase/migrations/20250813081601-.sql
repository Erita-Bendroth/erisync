-- Enhanced function to create default schedules excluding public holidays
CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays(
    _user_id UUID,
    _team_id UUID,
    _start_date DATE,
    _end_date DATE,
    _created_by UUID,
    _country_code TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    current_date DATE;
    day_of_week INTEGER;
    excluded_count INTEGER := 0;
    created_count INTEGER := 0;
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

    current_date := _start_date;
    
    WHILE current_date <= _end_date LOOP
        -- Get day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
        day_of_week := EXTRACT(DOW FROM current_date);
        
        -- Only create entries for Monday (2) through Friday (6)
        IF day_of_week BETWEEN 2 AND 6 THEN
            -- Check if this date is a public holiday for the user's country
            IF NOT EXISTS (
                SELECT 1 FROM public.holidays 
                WHERE date = current_date 
                AND country_code = user_country 
                AND is_public = true
            ) THEN
                -- Insert schedule entry if not already exists
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
                    current_date,
                    'normal',
                    'work',
                    'available',
                    'Auto-generated shift (08:00-16:30)',
                    _created_by
                )
                ON CONFLICT (user_id, date, team_id) DO NOTHING;
                
                -- Check if the insert actually happened
                IF FOUND THEN
                    created_count := created_count + 1;
                END IF;
            ELSE
                excluded_count := excluded_count + 1;
                RAISE NOTICE 'Excluded holiday: % for country %', current_date, user_country;
            END IF;
        END IF;
        
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    RAISE NOTICE 'Created % shifts, excluded % holidays for user % in country %', 
                 created_count, excluded_count, _user_id, user_country;
    
    RETURN created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Function to create schedules for all team members
CREATE OR REPLACE FUNCTION public.create_team_default_schedules_with_holidays(
    _team_id UUID,
    _start_date DATE,
    _end_date DATE,
    _created_by UUID
) RETURNS TABLE(user_id UUID, shifts_created INTEGER, country_code TEXT) AS $$
DECLARE
    member_record RECORD;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Function to create schedules for all users across all teams
CREATE OR REPLACE FUNCTION public.create_all_default_schedules_with_holidays(
    _start_date DATE,
    _end_date DATE,
    _created_by UUID
) RETURNS TABLE(team_name TEXT, user_count INTEGER, total_shifts INTEGER) AS $$
DECLARE
    team_record RECORD;
    user_record RECORD;
    team_total INTEGER;
BEGIN
    FOR team_record IN 
        SELECT t.id, t.name
        FROM public.teams t
    LOOP
        team_total := 0;
        
        FOR user_record IN
            SELECT tm.user_id, COALESCE(p.country_code, 'US') as country_code
            FROM public.team_members tm
            LEFT JOIN public.profiles p ON tm.user_id = p.user_id
            WHERE tm.team_id = team_record.id
        LOOP
            team_total := team_total + public.create_default_schedule_with_holidays(
                user_record.user_id,
                team_record.id,
                _start_date,
                _end_date,
                _created_by,
                user_record.country_code
            );
        END LOOP;
        
        SELECT team_record.name,
               (SELECT COUNT(*) FROM public.team_members WHERE team_id = team_record.id)::INTEGER,
               team_total
        INTO team_name, user_count, total_shifts;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';