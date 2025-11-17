-- Create partnership capacity configuration table
CREATE TABLE IF NOT EXISTS partnership_capacity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES team_planning_partners(id) ON DELETE CASCADE,
  min_staff_required INTEGER NOT NULL DEFAULT 1,
  max_staff_allowed INTEGER,
  applies_to_weekends BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(partnership_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partnership_capacity_config_partnership 
  ON partnership_capacity_config(partnership_id);

-- Enable RLS
ALTER TABLE partnership_capacity_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Managers can view if they manage ANY team in the partnership
CREATE POLICY "Managers can view their partnership capacity config"
ON partnership_capacity_config FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_capacity_config.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id::uuid IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    )
  )
);

-- RLS Policies: Managers can manage if they manage ANY team in the partnership
CREATE POLICY "Managers can manage their partnership capacity config"
ON partnership_capacity_config FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_capacity_config.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id::uuid IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_capacity_config.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id::uuid IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    )
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_partnership_capacity_config_updated_at
  BEFORE UPDATE ON partnership_capacity_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();