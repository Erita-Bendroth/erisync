-- Allow users to delete their own pending vacation requests
CREATE POLICY "Users can delete their own pending requests"
ON vacation_requests
FOR DELETE
USING (
  auth.uid() = user_id 
  AND status = 'pending'
);

-- Allow admins and planners to delete vacation requests
CREATE POLICY "Admins and planners can delete vacation requests"
ON vacation_requests
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
);