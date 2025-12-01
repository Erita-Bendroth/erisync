-- Partnership Rotation Rosters: Main roster metadata
CREATE TABLE partnership_rotation_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES team_planning_partners(id) ON DELETE CASCADE,
  roster_name TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('late', 'early', 'weekend', 'normal')),
  cycle_length_weeks INTEGER NOT NULL DEFAULT 5 CHECK (cycle_length_weeks > 0 AND cycle_length_weeks <= 52),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'implemented')),
  default_shift_for_non_duty TEXT DEFAULT 'normal' CHECK (default_shift_for_non_duty IN ('early', 'late', 'normal', 'weekend', 'none')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Person-week assignments (who has duty which week)
CREATE TABLE roster_week_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL REFERENCES partnership_rotation_rosters(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number > 0),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  assigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(roster_id, week_number, user_id)
);

-- Manager approvals
CREATE TABLE roster_manager_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL REFERENCES partnership_rotation_rosters(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(roster_id, manager_id, team_id)
);

-- Per-shift staffing requirements for partnerships
CREATE TABLE partnership_shift_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES team_planning_partners(id) ON DELETE CASCADE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('late', 'early', 'weekend', 'normal')),
  staff_required INTEGER NOT NULL DEFAULT 1 CHECK (staff_required >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partnership_id, shift_type)
);

-- Enable RLS
ALTER TABLE partnership_rotation_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_week_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_manager_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_shift_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partnership_rotation_rosters
CREATE POLICY "Managers can view rosters for their partnerships"
  ON partnership_rotation_rosters FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_rotation_rosters.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can create rosters for their partnerships"
  ON partnership_rotation_rosters FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_rotation_rosters.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can update rosters for their partnerships"
  ON partnership_rotation_rosters FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_rotation_rosters.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can delete draft rosters for their partnerships"
  ON partnership_rotation_rosters FOR DELETE
  USING (
    status = 'draft' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'planner'::app_role) OR
      (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
        SELECT 1 FROM team_planning_partners tpp
        WHERE tpp.id = partnership_rotation_rosters.partnership_id
        AND EXISTS (
          SELECT 1 FROM unnest(tpp.team_ids) AS team_id
          WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
        )
      ))
    )
  );

-- RLS Policies for roster_week_assignments
CREATE POLICY "Managers can view assignments for their partnership rosters"
  ON roster_week_assignments FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM partnership_rotation_rosters prr
      JOIN team_planning_partners tpp ON tpp.id = prr.partnership_id
      WHERE prr.id = roster_week_assignments.roster_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can manage assignments for their teams"
  ON roster_week_assignments FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND 
     team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND 
     team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
  );

-- RLS Policies for roster_manager_approvals
CREATE POLICY "Managers can view approvals for their partnership rosters"
  ON roster_manager_approvals FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM partnership_rotation_rosters prr
      JOIN team_planning_partners tpp ON tpp.id = prr.partnership_id
      WHERE prr.id = roster_manager_approvals.roster_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can manage their own approvals"
  ON roster_manager_approvals FOR ALL
  USING (
    manager_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  )
  WITH CHECK (
    manager_id = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  );

-- RLS Policies for partnership_shift_requirements
CREATE POLICY "Managers can view shift requirements for their partnerships"
  ON partnership_shift_requirements FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_shift_requirements.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

CREATE POLICY "Managers can manage shift requirements for their partnerships"
  ON partnership_shift_requirements FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_shift_requirements.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = partnership_shift_requirements.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) AS team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    ))
  );

-- Create indexes for performance
CREATE INDEX idx_partnership_rotation_rosters_partnership_id ON partnership_rotation_rosters(partnership_id);
CREATE INDEX idx_partnership_rotation_rosters_status ON partnership_rotation_rosters(status);
CREATE INDEX idx_roster_week_assignments_roster_id ON roster_week_assignments(roster_id);
CREATE INDEX idx_roster_week_assignments_user_id ON roster_week_assignments(user_id);
CREATE INDEX idx_roster_week_assignments_team_id ON roster_week_assignments(team_id);
CREATE INDEX idx_roster_manager_approvals_roster_id ON roster_manager_approvals(roster_id);
CREATE INDEX idx_roster_manager_approvals_manager_id ON roster_manager_approvals(manager_id);
CREATE INDEX idx_partnership_shift_requirements_partnership_id ON partnership_shift_requirements(partnership_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_partnership_rotation_rosters_updated_at
  BEFORE UPDATE ON partnership_rotation_rosters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roster_manager_approvals_updated_at
  BEFORE UPDATE ON roster_manager_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partnership_shift_requirements_updated_at
  BEFORE UPDATE ON partnership_shift_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();