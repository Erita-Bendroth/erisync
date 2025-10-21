-- Create function to calculate shift counts for users
-- This counts weekend shifts, night shifts, and holiday shifts
CREATE OR REPLACE FUNCTION public.get_user_shift_counts(
  _user_ids uuid[],
  _team_ids uuid[] DEFAULT NULL,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  weekend_shifts_count integer,
  night_shifts_count integer,
  holiday_shifts_count integer,
  total_shifts_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.user_id,
    -- Count weekend shifts (Saturday = 6, Sunday = 0 in date_part)
    COUNT(*) FILTER (
      WHERE EXTRACT(DOW FROM se.date) IN (0, 6)
      AND se.activity_type = 'work'
    )::integer AS weekend_shifts_count,
    -- Count night shifts
    COUNT(*) FILTER (
      WHERE se.shift_type = 'night'
      AND se.activity_type = 'work'
    )::integer AS night_shifts_count,
    -- Count holiday shifts (work on public holidays)
    COUNT(*) FILTER (
      WHERE se.activity_type = 'work'
      AND EXISTS (
        SELECT 1 FROM holidays h
        WHERE h.date = se.date
        AND h.is_public = true
        AND (h.user_id IS NULL OR h.user_id = se.user_id)
      )
    )::integer AS holiday_shifts_count,
    -- Total work shifts
    COUNT(*) FILTER (
      WHERE se.activity_type = 'work'
    )::integer AS total_shifts_count
  FROM schedule_entries se
  WHERE se.user_id = ANY(_user_ids)
    AND (_team_ids IS NULL OR se.team_id = ANY(_team_ids))
    AND (_start_date IS NULL OR se.date >= _start_date)
    AND (_end_date IS NULL OR se.date <= _end_date)
  GROUP BY se.user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_shift_counts TO authenticated;