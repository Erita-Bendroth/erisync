-- Drop the existing restrictive policy that only allowed deletion for draft rosters
DROP POLICY IF EXISTS "Managers can delete draft rosters for their partnerships" 
  ON partnership_rotation_rosters;

-- Create new policy allowing deletion for all statuses
CREATE POLICY "Managers can delete rosters for their partnerships" 
  ON partnership_rotation_rosters
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'planner'::app_role) 
    OR (
      has_role(auth.uid(), 'manager'::app_role) 
      AND EXISTS (
        SELECT 1 FROM team_planning_partners tpp
        WHERE tpp.id = partnership_rotation_rosters.partnership_id
        AND EXISTS (
          SELECT 1 FROM unnest(tpp.team_ids) team_id(team_id)
          WHERE team_id.team_id IN (
            SELECT get_manager_accessible_teams(auth.uid())
          )
        )
      )
    )
  );