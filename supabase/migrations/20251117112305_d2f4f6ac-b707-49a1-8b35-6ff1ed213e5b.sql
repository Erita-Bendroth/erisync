-- Create new RLS policy to allow managers to view profiles in planning partnerships
CREATE POLICY "Managers view profiles in planning partnerships"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if the profile's user is in a team that's part of a planning partnership
  -- where the requesting manager also has a team in that partnership
  EXISTS (
    SELECT 1
    FROM team_planning_partners tpp
    WHERE 
      -- Check if the profile's user is in any team that's part of this partnership
      EXISTS (
        SELECT 1
        FROM team_members tm
        WHERE tm.user_id = profiles.user_id
          AND tm.team_id = ANY(tpp.team_ids)
      )
      -- AND the requesting manager has at least one team in this same partnership
      AND EXISTS (
        SELECT 1
        FROM team_members tm2
        WHERE tm2.user_id = auth.uid()
          AND tm2.is_manager = true
          AND tm2.team_id = ANY(tpp.team_ids)
      )
  )
);