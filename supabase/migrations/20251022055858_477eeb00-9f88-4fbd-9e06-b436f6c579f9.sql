-- Create team capacity configuration table
CREATE TABLE IF NOT EXISTS team_capacity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  min_staff_required INTEGER NOT NULL DEFAULT 1,
  max_staff_allowed INTEGER,
  applies_to_weekends BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_capacity_config_team ON team_capacity_config(team_id);

-- RLS policies
ALTER TABLE team_capacity_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view their team capacity config"
ON team_capacity_config FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'planner')
  OR (has_role(auth.uid(), 'manager') AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

CREATE POLICY "Managers can manage their team capacity config"
ON team_capacity_config FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'planner')
  OR (has_role(auth.uid(), 'manager') AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'planner')
  OR (has_role(auth.uid(), 'manager') AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

-- Update get_team_capacity_metrics to use business days
CREATE OR REPLACE FUNCTION public.get_team_capacity_metrics(
  _team_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_days INTEGER;
  business_days INTEGER := 0;
  work_days INTEGER;
  available_days INTEGER;
  vacation_days INTEGER;
  sick_days INTEGER;
  other_days INTEGER;
  total_members INTEGER;
  utilization_rate NUMERIC;
  loop_date DATE;
BEGIN
  -- Get total team members
  SELECT COUNT(DISTINCT user_id) INTO total_members
  FROM team_members
  WHERE team_id = _team_id;
  
  -- Calculate business days (Mon-Fri, excluding holidays)
  loop_date := _start_date;
  WHILE loop_date <= _end_date LOOP
    -- Check if it's a weekday (1=Monday, 5=Friday in ISO week)
    IF EXTRACT(ISODOW FROM loop_date) BETWEEN 1 AND 5 THEN
      -- Check if it's not a holiday
      IF NOT EXISTS (
        SELECT 1 FROM holidays 
        WHERE date = loop_date 
        AND is_public = true
        AND user_id IS NULL
      ) THEN
        business_days := business_days + 1;
      END IF;
    END IF;
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
  
  -- Total expected work days = business days * total members
  total_days := business_days * total_members;
  
  -- Count actual scheduled days by activity type
  SELECT 
    COUNT(*) FILTER (WHERE activity_type = 'work'),
    COUNT(*) FILTER (WHERE availability_status = 'available'),
    COUNT(*) FILTER (WHERE activity_type = 'vacation'),
    COUNT(*) FILTER (WHERE activity_type = 'sick'),
    COUNT(*) FILTER (WHERE activity_type NOT IN ('work', 'vacation', 'sick'))
  INTO work_days, available_days, vacation_days, sick_days, other_days
  FROM schedule_entries
  WHERE team_id = _team_id
    AND date BETWEEN _start_date AND _end_date;
  
  -- Calculate utilization rate: actual work days vs expected work days
  utilization_rate := CASE 
    WHEN total_days > 0 THEN ROUND((work_days::NUMERIC / total_days::NUMERIC) * 100, 2)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'team_id', _team_id,
    'start_date', _start_date,
    'end_date', _end_date,
    'total_members', total_members,
    'business_days', business_days,
    'total_days', total_days,
    'work_days', work_days,
    'available_days', available_days,
    'vacation_days', vacation_days,
    'sick_days', sick_days,
    'other_days', other_days,
    'utilization_rate', utilization_rate
  );
END;
$$;

-- Update identify_coverage_gaps to use team config
CREATE OR REPLACE FUNCTION public.identify_coverage_gaps(
  _team_id UUID,
  _start_date DATE,
  _end_date DATE,
  _min_coverage INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  gaps JSONB;
  configured_min INTEGER;
BEGIN
  -- Get configured minimum from team_capacity_config, or use provided value, or default to 1
  SELECT min_staff_required INTO configured_min
  FROM team_capacity_config
  WHERE team_id = _team_id;
  
  -- Use the configured value if available, otherwise use provided or default
  configured_min := COALESCE(configured_min, _min_coverage, 1);
  
  -- Find dates with insufficient coverage (excluding weekends unless configured)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', gap_date,
      'scheduled_count', scheduled_count,
      'required', configured_min,
      'gap', configured_min - scheduled_count
    )
  )
  INTO gaps
  FROM (
    SELECT 
      d.date as gap_date,
      COALESCE(COUNT(se.id), 0) as scheduled_count
    FROM generate_series(_start_date, _end_date, '1 day'::interval) d(date)
    LEFT JOIN schedule_entries se ON se.date = d.date::DATE 
      AND se.team_id = _team_id 
      AND se.activity_type = 'work'
    WHERE EXTRACT(ISODOW FROM d.date) BETWEEN 1 AND 5  -- Only weekdays
    GROUP BY d.date
    HAVING COALESCE(COUNT(se.id), 0) < configured_min
    ORDER BY d.date
  ) sub;
  
  RETURN jsonb_build_object(
    'team_id', _team_id,
    'start_date', _start_date,
    'end_date', _end_date,
    'min_coverage', configured_min,
    'gaps', COALESCE(gaps, '[]'::jsonb)
  );
END;
$$;