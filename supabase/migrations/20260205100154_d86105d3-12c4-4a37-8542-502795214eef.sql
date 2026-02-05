-- Restore hierarchical edit permissions with downward cascade
-- Managers can edit teams where they are explicitly marked as is_manager = true
-- PLUS all descendant teams below those teams

CREATE OR REPLACE FUNCTION public.get_manager_editable_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE manager_teams AS (
    -- Base case: teams where user is explicitly marked as manager
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = _manager_id
      AND tm.is_manager = true
    
    UNION
    
    -- Recursive case: include all descendant teams
    SELECT t.id
    FROM public.teams t
    INNER JOIN manager_teams mt ON t.parent_team_id = mt.team_id
  )
  SELECT team_id FROM manager_teams;
$$;