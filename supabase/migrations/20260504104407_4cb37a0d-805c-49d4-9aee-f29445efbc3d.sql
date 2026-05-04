-- 1. Add carryover column
ALTER TABLE public.user_time_allowances
ADD COLUMN IF NOT EXISTS vacation_days_carryover INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_time_allowances.vacation_days_carryover IS 'Vacation days carried over from the previous year. User-editable.';

-- 2. Allow users to insert/update their own row (so they can set carryover even if no row exists)
CREATE POLICY "Users insert own allowances"
  ON public.user_time_allowances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own allowances"
  ON public.user_time_allowances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Update get_user_time_stats to include carryover
CREATE OR REPLACE FUNCTION public.get_user_time_stats(_user_id uuid, _team_ids uuid[], _year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  vacation_days_used INTEGER;
  flextime_hours_used NUMERIC;
  total_hours_worked NUMERIC;
  shift_counts JSONB;
  allowances RECORD;
BEGIN
  SELECT COUNT(*) INTO vacation_days_used
  FROM vacation_requests
  WHERE user_id = _user_id
    AND status = 'approved'
    AND is_full_day = true
    AND EXTRACT(YEAR FROM requested_date) = _year;

  SELECT COALESCE(SUM(parse_hours_from_notes(se.notes)), 0) INTO flextime_hours_used
  FROM schedule_entries se
  WHERE se.user_id = _user_id
    AND se.activity_type = 'flextime'
    AND EXTRACT(YEAR FROM se.date) = _year
    AND (_team_ids IS NULL OR se.team_id = ANY(_team_ids));

  SELECT COALESCE(SUM(parse_hours_from_notes(se.notes)), 0) INTO total_hours_worked
  FROM schedule_entries se
  WHERE se.user_id = _user_id
    AND se.activity_type IN ('work', 'working_from_home', 'hotline_support')
    AND EXTRACT(YEAR FROM se.date) = _year
    AND (_team_ids IS NULL OR se.team_id = ANY(_team_ids));

  SELECT jsonb_build_object(
    'weekend_shifts', COALESCE(weekend_shifts_count, 0),
    'night_shifts', COALESCE(night_shifts_count, 0),
    'holiday_shifts', COALESCE(holiday_shifts_count, 0),
    'total_shifts', COALESCE(total_shifts_count, 0)
  ) INTO shift_counts
  FROM get_user_shift_counts(
    ARRAY[_user_id],
    _team_ids,
    make_date(_year, 1, 1),
    make_date(_year, 12, 31)
  );

  SELECT
    COALESCE(uta.vacation_days_allowance, 30) as vacation_days_allowance,
    COALESCE(uta.vacation_days_carryover, 0) as vacation_days_carryover,
    COALESCE(uta.flextime_hours_allowance, 0) as flextime_hours_allowance,
    COALESCE(uta.is_override, false) as is_override
  INTO allowances
  FROM user_time_allowances uta
  WHERE uta.user_id = _user_id AND uta.year = _year;

  IF NOT FOUND THEN
    allowances.vacation_days_allowance := 30;
    allowances.vacation_days_carryover := 0;
    allowances.flextime_hours_allowance := 0;
    allowances.is_override := false;
  END IF;

  result := jsonb_build_object(
    'user_id', _user_id,
    'year', _year,
    'vacation_days_used', vacation_days_used,
    'vacation_days_allowance', allowances.vacation_days_allowance,
    'vacation_days_carryover', allowances.vacation_days_carryover,
    'vacation_days_remaining', (allowances.vacation_days_allowance + allowances.vacation_days_carryover) - vacation_days_used,
    'flextime_hours_used', ROUND(flextime_hours_used, 2),
    'flextime_hours_allowance', allowances.flextime_hours_allowance,
    'flextime_hours_remaining', allowances.flextime_hours_allowance - flextime_hours_used,
    'total_hours_worked', ROUND(total_hours_worked, 2),
    'weekend_shifts', (shift_counts->>'weekend_shifts')::INTEGER,
    'night_shifts', (shift_counts->>'night_shifts')::INTEGER,
    'holiday_shifts', (shift_counts->>'holiday_shifts')::INTEGER,
    'total_shifts', (shift_counts->>'total_shifts')::INTEGER,
    'is_override', allowances.is_override
  );

  RETURN result;
END;
$function$;