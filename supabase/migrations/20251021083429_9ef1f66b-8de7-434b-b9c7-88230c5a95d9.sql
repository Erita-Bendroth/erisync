-- Update shift counts function to properly match holidays by user's country/region
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
    -- Count weekend shifts (Saturday = 6, Sunday = 0 in EXTRACT DOW)
    COUNT(*) FILTER (
      WHERE EXTRACT(DOW FROM se.date) IN (0, 6)
      AND se.activity_type = 'work'
    )::integer AS weekend_shifts_count,
    -- Count night shifts (only 'late' and 'early' shifts)
    COUNT(*) FILTER (
      WHERE se.shift_type IN ('late', 'early')
      AND se.activity_type = 'work'
    )::integer AS night_shifts_count,
    -- Count holiday shifts (work on public holidays matching user's country/region)
    COUNT(*) FILTER (
      WHERE se.activity_type = 'work'
      AND EXISTS (
        SELECT 1 FROM holidays h
        LEFT JOIN profiles p ON p.user_id = se.user_id
        WHERE h.date = se.date
        AND h.is_public = true
        AND (
          -- Match global holidays (no user_id and matches user's country)
          (h.user_id IS NULL AND h.country_code = COALESCE(p.country_code, 'US'))
          -- Or user-specific holidays
          OR h.user_id = se.user_id
        )
        -- Optionally match region if specified
        AND (h.region_code IS NULL OR h.region_code = p.region_code OR p.region_code IS NULL)
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

GRANT EXECUTE ON FUNCTION public.get_user_shift_counts TO authenticated;