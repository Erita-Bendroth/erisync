-- Fix search_path security issue for are_teams_in_partnership function
CREATE OR REPLACE FUNCTION are_teams_in_partnership(team_a UUID, team_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM team_planning_partners
    WHERE team_a = ANY(team_ids) 
      AND team_b = ANY(team_ids)
  );
$$;