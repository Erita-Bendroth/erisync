-- Update RLS policy for vacation_requests to allow managers to approve requests
-- Drop the old policy
DROP POLICY IF EXISTS "Planners and admins can update vacation requests" ON public.vacation_requests;

-- Create new policy that allows managers, planners, and admins to update
CREATE POLICY "Managers, planners and admins can update vacation requests"
ON public.vacation_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND 
   has_manager_access(auth.uid(), team_id))
);