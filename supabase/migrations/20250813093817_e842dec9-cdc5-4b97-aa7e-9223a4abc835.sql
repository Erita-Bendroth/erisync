-- Drop the existing restrictive policies for team_members viewing
DROP POLICY IF EXISTS "Users can view team memberships" ON public.team_members;

-- Create a new policy that allows all authenticated users to view team memberships
CREATE POLICY "All authenticated users can view team memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Ensure we can still see profiles joined with team members
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "All authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);