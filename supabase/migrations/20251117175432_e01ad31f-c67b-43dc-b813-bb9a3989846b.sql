-- Restrict planning partnership management to admins only
-- Drop existing write policies for planners and managers

-- Drop planner write policies for team_planning_partners
DROP POLICY IF EXISTS "Planners can manage all planning partnerships" ON public.team_planning_partners;

-- Drop manager write policies for team_planning_partners
DROP POLICY IF EXISTS "Managers can create partnerships for their teams" ON public.team_planning_partners;
DROP POLICY IF EXISTS "Managers can update partnerships for their teams" ON public.team_planning_partners;
DROP POLICY IF EXISTS "Managers can delete partnerships for their teams" ON public.team_planning_partners;

-- Create new read-only policy for planners on team_planning_partners
CREATE POLICY "Planners can view all planning partnerships"
ON public.team_planning_partners
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'planner'::app_role));

-- Admin policy already exists and remains unchanged
-- Manager and team member read policies already exist and remain unchanged

-- Update partnership_capacity_config policies to match
-- Drop write policies for planners and managers
DROP POLICY IF EXISTS "Managers can manage their partnership capacity config" ON public.partnership_capacity_config;

-- Create new read-only policy for planners on partnership_capacity_config
CREATE POLICY "Planners can view all capacity configs"
ON public.partnership_capacity_config
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'planner'::app_role));

-- Create new read-only policy for managers to view their partnerships' capacity config
CREATE POLICY "Managers can view their partnership capacity configs"
ON public.partnership_capacity_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM team_planning_partners tpp
    WHERE tpp.id = partnership_capacity_config.partnership_id
    AND EXISTS (
      SELECT 1 FROM unnest(tpp.team_ids) AS team_id
      WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
    )
  )
);

-- Admin policies already exist and remain unchanged for both tables