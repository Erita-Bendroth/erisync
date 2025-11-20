-- Create user_time_allowances table
CREATE TABLE user_time_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  vacation_days_allowance INTEGER NOT NULL DEFAULT 30,
  flextime_hours_allowance NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_override BOOLEAN NOT NULL DEFAULT false,
  set_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

CREATE INDEX idx_user_time_allowances_user_year ON user_time_allowances(user_id, year);

ALTER TABLE user_time_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own allowances"
  ON user_time_allowances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers view team allowances"
  ON user_time_allowances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = user_time_allowances.user_id
    )
  );

CREATE POLICY "Managers manage team allowances"
  ON user_time_allowances FOR ALL
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = user_time_allowances.user_id
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = user_time_allowances.user_id
    )
  );

CREATE POLICY "Admins planners manage all allowances"
  ON user_time_allowances FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'planner'::app_role)
  );

CREATE TRIGGER update_user_time_allowances_updated_at
  BEFORE UPDATE ON user_time_allowances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to parse hours from time string like "08:00-16:30"
CREATE OR REPLACE FUNCTION parse_hours_from_notes(notes TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Function to calculate user time statistics
CREATE OR REPLACE FUNCTION get_user_time_stats(
  _user_id UUID,
  _team_ids UUID[],
  _year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(uta.flextime_hours_allowance, 0) as flextime_hours_allowance,
    COALESCE(uta.is_override, false) as is_override
  INTO allowances
  FROM user_time_allowances uta
  WHERE uta.user_id = _user_id AND uta.year = _year;
  
  IF NOT FOUND THEN
    allowances.vacation_days_allowance := 30;
    allowances.flextime_hours_allowance := 0;
    allowances.is_override := false;
  END IF;
  
  result := jsonb_build_object(
    'user_id', _user_id,
    'year', _year,
    'vacation_days_used', vacation_days_used,
    'vacation_days_allowance', allowances.vacation_days_allowance,
    'vacation_days_remaining', allowances.vacation_days_allowance - vacation_days_used,
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
$$;

-- Function to reset allowances annually
CREATE OR REPLACE FUNCTION reset_annual_allowances()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  prev_year INTEGER := current_year - 1;
  affected_rows INTEGER;
BEGIN
  INSERT INTO user_time_allowances (
    user_id,
    year,
    vacation_days_allowance,
    flextime_hours_allowance,
    is_override,
    set_by
  )
  SELECT 
    user_id,
    current_year,
    vacation_days_allowance,
    flextime_hours_allowance,
    is_override,
    set_by
  FROM user_time_allowances
  WHERE year = prev_year
    AND is_override = true
  ON CONFLICT (user_id, year) DO NOTHING;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  INSERT INTO cron_job_logs (job_name, status, response_data)
  VALUES (
    'reset-annual-allowances',
    'success',
    jsonb_build_object(
      'year', current_year,
      'overrides_carried_forward', affected_rows,
      'timestamp', now()
    )
  );
END;
$$;

SELECT cron.schedule(
  'reset-annual-allowances',
  '1 0 1 1 *',
  $$SELECT reset_annual_allowances();$$
);