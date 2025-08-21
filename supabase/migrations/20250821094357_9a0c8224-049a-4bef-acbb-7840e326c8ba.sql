-- Fix the manager profile access policy to ensure managers can see ALL their team members' profiles
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Managers can view direct team member profiles only" ON profiles;

-- Create a better policy that allows managers to see their team members' profiles
CREATE POLICY "Managers can view team member profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  auth.uid() = user_id
  OR
  -- Managers can see profiles of users in teams they manage
  (
    has_role(auth.uid(), 'manager'::app_role) 
    AND user_id IN (
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT DISTINCT team_members.team_id
        FROM team_members
        WHERE team_members.user_id = auth.uid() 
        AND team_members.is_manager = true
      )
    )
  )
);

-- Also ensure the existing user profile policy still works
-- This policy should already exist, but let's make sure it's not conflicting
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);