-- Create shift_rotation_templates table
CREATE TABLE shift_rotation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  team_ids UUID[] NOT NULL,
  
  -- Rotation Pattern Definition
  pattern_type TEXT NOT NULL,
  pattern_config JSONB NOT NULL,
  
  -- Metadata
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_pattern_type CHECK (pattern_type IN ('fixed_days', 'repeating_sequence', 'weekly_pattern', 'custom'))
);

-- Indexes
CREATE INDEX idx_shift_rotation_templates_team_ids ON shift_rotation_templates USING GIN (team_ids);
CREATE INDEX idx_shift_rotation_templates_created_by ON shift_rotation_templates(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_shift_rotation_templates_updated_at
  BEFORE UPDATE ON shift_rotation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE shift_rotation_templates ENABLE ROW LEVEL SECURITY;

-- Managers can view templates for their teams or public templates
CREATE POLICY "Managers can view templates for their teams"
  ON shift_rotation_templates FOR SELECT
  USING (
    is_public = true OR
    created_by = auth.uid() OR
    (
      has_role(auth.uid(), 'manager'::app_role) AND
      team_ids && ARRAY(SELECT get_manager_accessible_teams(auth.uid()))
    ) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  );

-- Managers can create templates for their teams
CREATE POLICY "Managers can create templates for their teams"
  ON shift_rotation_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (
      (
        has_role(auth.uid(), 'manager'::app_role) AND
        team_ids <@ ARRAY(SELECT get_manager_accessible_teams(auth.uid()))
      ) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'planner'::app_role)
    )
  );

-- Managers can update their own templates
CREATE POLICY "Managers can update their own templates"
  ON shift_rotation_templates FOR UPDATE
  USING (
    created_by = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Managers can delete their own templates
CREATE POLICY "Managers can delete their own templates"
  ON shift_rotation_templates FOR DELETE
  USING (
    created_by = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role)
  );