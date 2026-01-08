-- Drop the overly permissive team member policies that allow enumeration
DROP POLICY IF EXISTS "Team members can view manager profiles" ON public.profiles;
DROP POLICY IF EXISTS "Team members can view parent team manager profiles" ON public.profiles;

-- Create a more restrictive policy that only allows viewing profiles 
-- when there's a legitimate scheduling/work relationship
-- This policy allows viewing basic info only for teammates in the SAME team
CREATE POLICY "Team members can view teammate basic profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- Users can always see their own profile
  auth.uid() = user_id
  OR
  -- Allow viewing if both users are in the same team (needed for scheduling)
  EXISTS (
    SELECT 1 
    FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
    AND tm2.user_id = profiles.user_id
  )
);

-- Note: Managers, planners, and admins already have their own policies
-- The existing policies are:
-- - "Users can view their own profile" (auth.uid() = user_id)
-- - "Planners view all profiles" (has_role 'planner')
-- - "Managers view accessible team member profiles" (proper hierarchy check)
-- - "Managers view profiles in planning partnerships" (partnership check)

-- Add comment explaining the security model
COMMENT ON POLICY "Team members can view teammate basic profiles" ON public.profiles IS 
'Allows authenticated users to view profiles of people in the same team. This is necessary for scheduling features. Sensitive data (email) is protected via the mask_email function in queries.';