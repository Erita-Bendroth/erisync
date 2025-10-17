-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view members of their own teams" ON team_members;

-- Create a security definer function to check if a user is in the same team
CREATE OR REPLACE FUNCTION public.is_in_same_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Create the policy using the security definer function
CREATE POLICY "Team members can view members of their own teams"
ON team_members
FOR SELECT
USING (
  public.is_in_same_team(auth.uid(), team_id)
);