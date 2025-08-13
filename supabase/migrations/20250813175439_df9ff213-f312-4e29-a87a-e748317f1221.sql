-- Check if we need to update RLS policies for holidays table
-- The issue might be that planners/admins can't insert holidays for other users

-- Add policy to allow planners and admins to insert holidays for any user
CREATE POLICY "Planners and admins can insert holidays for any user"
ON public.holidays
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'planner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add policy to allow planners and admins to update holidays for any user  
CREATE POLICY "Planners and admins can update holidays for any user"
ON public.holidays
FOR UPDATE
USING (
  has_role(auth.uid(), 'planner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);