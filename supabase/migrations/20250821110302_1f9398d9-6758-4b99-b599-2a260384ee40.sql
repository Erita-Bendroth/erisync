-- Update the manager policy to allow viewing basic profile info for all team-assigned users
DROP POLICY IF EXISTS "Managers can view team member profiles" ON public.profiles;

-- Create a new policy that allows managers to see basic profile info for all users assigned to teams
CREATE POLICY "Managers can view all team member profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  user_id IN (
    SELECT DISTINCT tm.user_id 
    FROM team_members tm 
    WHERE tm.user_id IS NOT NULL
  )
);