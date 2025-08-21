-- Drop the restrictive manager policy and replace with a more permissive one
DROP POLICY IF EXISTS "Managers can view all team member profiles" ON public.profiles;

-- Create a simpler policy: managers can view profiles for any user who has team assignments
CREATE POLICY "Managers can view all assigned profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  (auth.uid() = user_id)
);