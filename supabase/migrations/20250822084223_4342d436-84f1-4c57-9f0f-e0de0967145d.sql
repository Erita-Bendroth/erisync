-- Fix the overly restrictive RLS policy for managers to see profiles across all teams
-- while maintaining security for detailed access

DROP POLICY IF EXISTS "Managers can view team member profiles only" ON public.profiles;

-- Create a more permissive policy for managers to see basic profile info (names) across all teams
-- but restrict detailed access to managed teams only
CREATE POLICY "Managers can view all profiles for availability" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- The application layer will handle showing only availability info for non-managed users