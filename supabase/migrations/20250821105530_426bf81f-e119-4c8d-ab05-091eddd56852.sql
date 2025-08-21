-- Broaden managers' visibility on team_members to support initials-only view for other teams
DROP POLICY IF EXISTS "Managers can view their team members" ON public.team_members;

CREATE POLICY "Managers can view team_members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  -- Users can see their own memberships
  auth.uid() = user_id
  OR
  -- Admins and planners see all
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR
  -- Managers can read all team_members rows (UI restricts details)
  has_role(auth.uid(), 'manager'::app_role)
);
