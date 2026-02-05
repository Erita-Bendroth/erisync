-- Update get_manager_editable_teams to only return teams where user is EXPLICITLY marked as manager
-- This removes the recursive descent that previously included all descendant teams
-- Viewing access (get_manager_accessible_teams) remains unchanged and recursive

CREATE OR REPLACE FUNCTION public.get_manager_editable_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return teams where user is EXPLICITLY marked as manager
  -- This does NOT cascade to child teams - managers must be 
  -- explicitly assigned to each team they can edit
  SELECT tm.team_id 
  FROM public.team_members tm
  WHERE tm.user_id = _manager_id
    AND tm.is_manager = true;
$$;