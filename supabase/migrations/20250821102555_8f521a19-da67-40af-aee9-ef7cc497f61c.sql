-- Fix the team_members RLS policy to allow managers to view members of teams they manage

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "select_teams_final" ON team_members;

-- Create a new policy that allows managers to see team members of teams they manage
CREATE POLICY "Managers can view their team members"
ON team_members
FOR SELECT
TO authenticated
USING (
  -- Users can see their own team memberships
  auth.uid() = user_id
  OR
  -- Admins and planners can see all team memberships
  has_role(auth.uid(), 'admin'::app_role)
  OR 
  has_role(auth.uid(), 'planner'::app_role)
  OR
  -- Managers can see team members of teams they manage
  (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IN (
      SELECT tm.team_id 
      FROM team_members tm 
      WHERE tm.user_id = auth.uid() 
      AND tm.is_manager = true
    )
  )
);