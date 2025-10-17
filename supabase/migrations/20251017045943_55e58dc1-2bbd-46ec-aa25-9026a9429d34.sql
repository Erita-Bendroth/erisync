-- Allow team members to view other members of their own teams
CREATE POLICY "Team members can view members of their own teams"
ON team_members
FOR SELECT
USING (
  -- User can see members of teams they belong to
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);