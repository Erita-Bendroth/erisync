-- Create function to check if two teams are in the same partnership
CREATE OR REPLACE FUNCTION are_teams_in_partnership(team_a UUID, team_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM team_planning_partners
    WHERE team_a = ANY(team_ids) 
      AND team_b = ANY(team_ids)
  );
$$;

-- Update RLS policy for creating swap requests to allow cross-partnership swaps
DROP POLICY IF EXISTS "Team members create swap requests" ON shift_swap_requests;

CREATE POLICY "Team members create swap requests"
  ON shift_swap_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requesting_user_id AND
    -- User must be in the requesting team
    team_id IN (SELECT get_user_teams(auth.uid())) AND
    -- Target user must be either in the same team OR in a partnership team
    EXISTS (
      SELECT 1 FROM schedule_entries se
      WHERE se.id = target_entry_id
      AND (
        se.team_id = team_id OR
        are_teams_in_partnership(team_id, se.team_id)
      )
    )
  );

-- Update manager view policy to include partnership teams
DROP POLICY IF EXISTS "Managers view team swap requests" ON shift_swap_requests;

CREATE POLICY "Managers view team swap requests"
  ON shift_swap_requests FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager') AND
    (
      team_id IN (SELECT get_manager_accessible_teams(auth.uid())) OR
      EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.id = target_entry_id
        AND se.team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    )
  );