-- Fix vacation_requests INSERT policy to allow managers to create requests for their team members

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create vacation requests" ON public.vacation_requests;

-- Create new policy that allows managers to insert vacation requests for their team members
CREATE POLICY "Users and managers can create vacation requests"
ON public.vacation_requests
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id  -- Users can create their own requests
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admins can create for anyone
  OR has_role(auth.uid(), 'planner'::app_role)  -- Planners can create for anyone
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND has_manager_access(auth.uid(), team_id)  -- Managers can create for their teams
  )
);