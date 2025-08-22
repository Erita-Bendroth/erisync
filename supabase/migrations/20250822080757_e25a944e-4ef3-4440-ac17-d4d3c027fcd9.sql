-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "select_roles_final" ON public.user_roles;

-- Create a new policy that allows managers to see roles of users in their teams
CREATE POLICY "Managers can view team member roles" 
ON public.user_roles 
FOR SELECT 
USING (
  -- Admins and planners can see all roles
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
  -- Users can see their own roles
  OR (auth.uid() = user_id)
  -- Managers can see roles of users in their managed teams
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND user_id IN (
      SELECT tm.user_id 
      FROM public.team_members tm
      WHERE tm.team_id IN (
        SELECT team_id 
        FROM public.team_members 
        WHERE user_id = auth.uid() AND is_manager = true
      )
    )
  )
);