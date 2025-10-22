-- Analytics Dashboard Database Schema

-- Create analytics snapshots table for pre-calculated metrics
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('capacity', 'utilization', 'fairness', 'coverage', 'distribution')),
  metric_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_snapshots_team_date ON public.analytics_snapshots(team_id, snapshot_date);
CREATE INDEX idx_analytics_snapshots_metric_type ON public.analytics_snapshots(metric_type);
CREATE INDEX idx_analytics_snapshots_date ON public.analytics_snapshots(snapshot_date);

-- Enable RLS
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_snapshots
CREATE POLICY "Admins can manage all analytics snapshots"
ON public.analytics_snapshots
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can view and manage all analytics snapshots"
ON public.analytics_snapshots
FOR ALL
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can view analytics for their teams"
ON public.analytics_snapshots
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
);

-- Create schedule change log table for audit trail
CREATE TABLE IF NOT EXISTS public.schedule_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_entry_id UUID REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_change_log_entry ON public.schedule_change_log(schedule_entry_id);
CREATE INDEX idx_schedule_change_log_date ON public.schedule_change_log(changed_at);
CREATE INDEX idx_schedule_change_log_team ON public.schedule_change_log(team_id);

-- Enable RLS
ALTER TABLE public.schedule_change_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_change_log
CREATE POLICY "Admins can view all schedule change logs"
ON public.schedule_change_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can view all schedule change logs"
ON public.schedule_change_log
FOR SELECT
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can view change logs for their teams"
ON public.schedule_change_log
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
);

CREATE POLICY "System can insert schedule change logs"
ON public.schedule_change_log
FOR INSERT
WITH CHECK (true);

-- Create dashboard preferences table
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  default_date_range TEXT DEFAULT '30',
  favorite_metrics TEXT[] DEFAULT ARRAY['capacity', 'fairness', 'coverage'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_preferences_user ON public.dashboard_preferences(user_id);

-- Enable RLS
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard_preferences
CREATE POLICY "Users can manage their own dashboard preferences"
ON public.dashboard_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger to update updated_at on analytics_snapshots
CREATE TRIGGER update_analytics_snapshots_updated_at
BEFORE UPDATE ON public.analytics_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update updated_at on dashboard_preferences
CREATE TRIGGER update_dashboard_preferences_updated_at
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Analytics Function: Calculate team capacity metrics
CREATE OR REPLACE FUNCTION public.get_team_capacity_metrics(
  _team_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_days INTEGER;
  work_days INTEGER;
  available_days INTEGER;
  vacation_days INTEGER;
  sick_days INTEGER;
  other_days INTEGER;
  total_members INTEGER;
  utilization_rate NUMERIC;
BEGIN
  -- Get total team members
  SELECT COUNT(DISTINCT user_id) INTO total_members
  FROM team_members
  WHERE team_id = _team_id;
  
  -- Calculate total possible work days
  total_days := (_end_date - _start_date + 1) * total_members;
  
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
  
  -- Calculate utilization rate
  utilization_rate := CASE 
    WHEN total_days > 0 THEN ROUND((work_days::NUMERIC / total_days::NUMERIC) * 100, 2)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'team_id', _team_id,
    'start_date', _start_date,
    'end_date', _end_date,
    'total_members', total_members,
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

-- Analytics Function: Get scheduling efficiency metrics
CREATE OR REPLACE FUNCTION public.get_scheduling_efficiency(
  _team_ids UUID[],
  _start_date DATE,
  _end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  shift_distribution JSONB;
  activity_distribution JSONB;
  changes_count INTEGER;
BEGIN
  -- Get shift type distribution
  SELECT jsonb_object_agg(shift_type, count)
  INTO shift_distribution
  FROM (
    SELECT 
      COALESCE(shift_type::TEXT, 'normal') as shift_type,
      COUNT(*) as count
    FROM schedule_entries
    WHERE team_id = ANY(_team_ids)
      AND date BETWEEN _start_date AND _end_date
    GROUP BY shift_type
  ) s;
  
  -- Get activity type distribution
  SELECT jsonb_object_agg(activity_type, count)
  INTO activity_distribution
  FROM (
    SELECT 
      activity_type::TEXT,
      COUNT(*) as count
    FROM schedule_entries
    WHERE team_id = ANY(_team_ids)
      AND date BETWEEN _start_date AND _end_date
    GROUP BY activity_type
  ) a;
  
  -- Count schedule changes
  SELECT COUNT(*)
  INTO changes_count
  FROM schedule_change_log
  WHERE team_id = ANY(_team_ids)
    AND changed_at BETWEEN _start_date::TIMESTAMPTZ AND (_end_date + INTERVAL '1 day')::TIMESTAMPTZ;
  
  result := jsonb_build_object(
    'team_ids', _team_ids,
    'start_date', _start_date,
    'end_date', _end_date,
    'shift_distribution', COALESCE(shift_distribution, '{}'::jsonb),
    'activity_distribution', COALESCE(activity_distribution, '{}'::jsonb),
    'total_changes', changes_count
  );
  
  RETURN result;
END;
$$;

-- Analytics Function: Identify coverage gaps
CREATE OR REPLACE FUNCTION public.identify_coverage_gaps(
  _team_id UUID,
  _start_date DATE,
  _end_date DATE,
  _min_coverage INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gaps JSONB;
BEGIN
  -- Find dates with insufficient coverage
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', gap_date,
      'scheduled_count', scheduled_count,
      'gap', _min_coverage - scheduled_count
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
    GROUP BY d.date
    HAVING COALESCE(COUNT(se.id), 0) < _min_coverage
    ORDER BY d.date
  ) sub;
  
  RETURN jsonb_build_object(
    'team_id', _team_id,
    'start_date', _start_date,
    'end_date', _end_date,
    'min_coverage', _min_coverage,
    'gaps', COALESCE(gaps, '[]'::jsonb)
  );
END;
$$;

-- Analytics Function: Analyze vacation patterns
CREATE OR REPLACE FUNCTION public.analyze_vacation_patterns(
  _team_id UUID,
  _lookback_months INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_date DATE;
  patterns JSONB;
  total_requests INTEGER;
  approved_requests INTEGER;
  pending_requests INTEGER;
  rejected_requests INTEGER;
BEGIN
  start_date := CURRENT_DATE - (_lookback_months || ' months')::INTERVAL;
  
  -- Count vacation requests by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO total_requests, approved_requests, pending_requests, rejected_requests
  FROM vacation_requests
  WHERE team_id = _team_id
    AND requested_date >= start_date;
  
  -- Get monthly breakdown
  SELECT jsonb_object_agg(month, request_count)
  INTO patterns
  FROM (
    SELECT 
      TO_CHAR(requested_date, 'YYYY-MM') as month,
      COUNT(*) as request_count
    FROM vacation_requests
    WHERE team_id = _team_id
      AND requested_date >= start_date
    GROUP BY TO_CHAR(requested_date, 'YYYY-MM')
    ORDER BY month
  ) m;
  
  RETURN jsonb_build_object(
    'team_id', _team_id,
    'lookback_months', _lookback_months,
    'total_requests', total_requests,
    'approved', approved_requests,
    'pending', pending_requests,
    'rejected', rejected_requests,
    'monthly_patterns', COALESCE(patterns, '{}'::jsonb)
  );
END;
$$;