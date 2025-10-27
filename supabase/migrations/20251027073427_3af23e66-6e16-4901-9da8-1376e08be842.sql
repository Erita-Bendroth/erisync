-- Add holiday and coverage preferences to dashboard_preferences
ALTER TABLE dashboard_preferences
ADD COLUMN IF NOT EXISTS show_holidays_default BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS coverage_threshold INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS fairness_weight DECIMAL(3,2) DEFAULT 0.50;

COMMENT ON COLUMN dashboard_preferences.show_holidays_default IS 'Default visibility for holidays and weekends in schedule views';
COMMENT ON COLUMN dashboard_preferences.coverage_threshold IS 'Coverage percentage threshold for alerts (default 90%)';
COMMENT ON COLUMN dashboard_preferences.fairness_weight IS 'Weight for fairness vs coverage in scheduling (0-1, default 0.5)';

-- Add team-level holiday exclusion settings
CREATE TABLE IF NOT EXISTS team_holiday_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  exclude_from_coverage BOOLEAN DEFAULT false,
  include_weekends_in_coverage BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id)
);

-- Enable RLS
ALTER TABLE team_holiday_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_holiday_settings
CREATE POLICY "Managers can view their team holiday settings"
  ON team_holiday_settings FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'planner'::app_role) OR
      (has_role(auth.uid(), 'manager'::app_role) AND 
       team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
    )
  );

CREATE POLICY "Managers can manage their team holiday settings"
  ON team_holiday_settings FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'planner'::app_role) OR
      (has_role(auth.uid(), 'manager'::app_role) AND 
       team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'planner'::app_role) OR
      (has_role(auth.uid(), 'manager'::app_role) AND 
       team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_team_holiday_settings_updated_at
  BEFORE UPDATE ON team_holiday_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();