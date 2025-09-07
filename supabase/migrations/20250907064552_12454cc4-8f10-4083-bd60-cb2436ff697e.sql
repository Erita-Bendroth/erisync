-- Fix function overload conflict by dropping the older version
-- The issue is that there are multiple create_default_schedule_with_holidays functions
-- with overlapping signatures that PostgreSQL can't distinguish between

-- Drop the older version that only has country_code parameter
DROP FUNCTION IF EXISTS public.create_default_schedule_with_holidays(_user_id uuid, _team_id uuid, _start_date date, _end_date date, _created_by uuid, _country_code text);

-- Keep only the newer version that has both country_code and region_code parameters
-- This is already defined in the database, so no need to recreate it