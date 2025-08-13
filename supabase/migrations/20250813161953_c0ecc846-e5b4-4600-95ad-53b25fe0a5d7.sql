-- Fix remaining function search path issues

-- Fix import_holidays_for_year function with proper search_path
CREATE OR REPLACE FUNCTION public.import_holidays_for_year(_country_code text, _year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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