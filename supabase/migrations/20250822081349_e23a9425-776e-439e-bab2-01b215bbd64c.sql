-- Fix profiles RLS policy to properly scope manager access to their teams only
DROP POLICY IF EXISTS "Managers can view all assigned profiles" ON public.profiles;

-- Create a more secure policy for managers to only see profiles of users in their managed teams
CREATE POLICY "Managers can view team member profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  -- Admins and planners can see all profiles
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
  -- Users can see their own profile
  OR (auth.uid() = user_id)
  -- Managers can only see profiles of users in their managed teams
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

-- Add logging trigger for profile access
CREATE OR REPLACE FUNCTION public.log_profile_access_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when profiles are accessed by managers/admins
  IF auth.uid() != NEW.user_id AND (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  ) THEN
    PERFORM log_profile_access(NEW.user_id, 'SELECT');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;