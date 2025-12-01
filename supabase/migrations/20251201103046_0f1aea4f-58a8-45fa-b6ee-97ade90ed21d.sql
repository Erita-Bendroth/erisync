-- Add hotline to duty_type enum
ALTER TYPE duty_type ADD VALUE IF NOT EXISTS 'hotline';

-- Create hotline_eligible_members table
CREATE TABLE IF NOT EXISTS hotline_eligible_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create hotline_team_config table
CREATE TABLE IF NOT EXISTS hotline_team_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  min_staff_required INTEGER DEFAULT 1,
  weekday_start_time TIME DEFAULT '08:00',
  weekday_end_time TIME DEFAULT '15:00',
  friday_start_time TIME DEFAULT '08:00',
  friday_end_time TIME DEFAULT '13:00',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create hotline_draft_assignments table
CREATE TABLE IF NOT EXISTS hotline_draft_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_substitute BOOLEAN DEFAULT false,
  original_user_id UUID,
  status TEXT DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, date, user_id)
);

-- Enable RLS
ALTER TABLE hotline_eligible_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotline_team_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotline_draft_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hotline_eligible_members
CREATE POLICY "Managers can manage their team's hotline eligibility"
ON hotline_eligible_members FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

-- RLS Policies for hotline_team_config
CREATE POLICY "Managers can manage their team's hotline config"
ON hotline_team_config FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

-- RLS Policies for hotline_draft_assignments
CREATE POLICY "Managers can manage hotline drafts for their teams"
ON hotline_draft_assignments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hotline_eligible_team ON hotline_eligible_members(team_id);
CREATE INDEX IF NOT EXISTS idx_hotline_eligible_user ON hotline_eligible_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hotline_config_team ON hotline_team_config(team_id);
CREATE INDEX IF NOT EXISTS idx_hotline_draft_team ON hotline_draft_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_hotline_draft_date ON hotline_draft_assignments(date);

-- Add updated_at trigger for hotline_eligible_members
CREATE TRIGGER update_hotline_eligible_members_updated_at
BEFORE UPDATE ON hotline_eligible_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for hotline_team_config
CREATE TRIGGER update_hotline_team_config_updated_at
BEFORE UPDATE ON hotline_team_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();