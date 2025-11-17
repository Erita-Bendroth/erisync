-- Create team_planning_partners table for co-planning between teams
CREATE TABLE public.team_planning_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_name TEXT NOT NULL,
  team_ids UUID[] NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_ids_not_empty CHECK (array_length(team_ids, 1) >= 2)
);

-- Create index for faster queries
CREATE INDEX idx_team_planning_partners_team_ids ON public.team_planning_partners USING GIN (team_ids);

-- Enable RLS
ALTER TABLE public.team_planning_partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins and planners can manage all partnerships
CREATE POLICY "Admins can manage all planning partnerships"
ON public.team_planning_partners
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can manage all planning partnerships"
ON public.team_planning_partners
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'planner'::app_role));

-- Managers can view and manage partnerships if they manage any team in the partnership
CREATE POLICY "Managers can view partnerships for their teams"
ON public.team_planning_partners
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

CREATE POLICY "Managers can create partnerships for their teams"
ON public.team_planning_partners
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND
  team_ids <@ ARRAY(SELECT get_manager_accessible_teams(auth.uid()))
);

CREATE POLICY "Managers can update partnerships for their teams"
ON public.team_planning_partners
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

CREATE POLICY "Managers can delete partnerships for their teams"
ON public.team_planning_partners
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

-- Team members can view partnerships if their team is included
CREATE POLICY "Team members can view partnerships including their team"
ON public.team_planning_partners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_user_teams(auth.uid()))
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_team_planning_partners_updated_at
BEFORE UPDATE ON public.team_planning_partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();