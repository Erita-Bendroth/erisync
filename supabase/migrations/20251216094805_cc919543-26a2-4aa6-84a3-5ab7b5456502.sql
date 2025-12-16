-- Create roster activity log table
CREATE TABLE public.roster_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL REFERENCES partnership_rotation_rosters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_team_id UUID,
  week_number INTEGER,
  day_of_week INTEGER,
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roster_activity_log ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_roster_activity_log_roster ON public.roster_activity_log(roster_id);
CREATE INDEX idx_roster_activity_log_created ON public.roster_activity_log(created_at DESC);

-- RLS Policies: Same as roster_week_assignments
CREATE POLICY "Managers can view activity for their partnership rosters"
ON public.roster_activity_log
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM partnership_rotation_rosters prr
    JOIN team_planning_partners tpp ON tpp.id = prr.partnership_id
    WHERE prr.id = roster_activity_log.roster_id
    AND EXISTS (
      SELECT 1 FROM unnest(tpp.team_ids) team_id
      WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
    )
  ))
);

CREATE POLICY "System can insert activity logs"
ON public.roster_activity_log
FOR INSERT
WITH CHECK (true);