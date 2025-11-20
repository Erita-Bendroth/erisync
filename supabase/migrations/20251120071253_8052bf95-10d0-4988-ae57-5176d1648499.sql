-- Fix security warning: Add search_path to parse_hours_from_notes function
CREATE OR REPLACE FUNCTION parse_hours_from_notes(notes TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  time_parts TEXT[];
  start_time TIME;
  end_time TIME;
BEGIN
  IF notes ~ '\d{2}:\d{2}-\d{2}:\d{2}' THEN
    time_parts := regexp_matches(notes, '(\d{2}:\d{2})-(\d{2}:\d{2})');
    start_time := time_parts[1]::TIME;
    end_time := time_parts[2]::TIME;
    RETURN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600;
  ELSE
    RETURN 8.5;
  END IF;
END;
$$;