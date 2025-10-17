-- Add safeguard to prevent infinite loops in recursive team hierarchy
-- This adds a depth limit and cycle detection to the get_all_subteam_ids function

CREATE OR REPLACE FUNCTION public.get_all_subteam_ids(_team_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE subteams AS (
    -- Start with the given team at depth 0
    SELECT id, 0 as depth, ARRAY[id] as path 
    FROM public.teams 
    WHERE id = _team_id
    
    UNION
    
    -- Recursively find all child teams with cycle detection
    SELECT t.id, st.depth + 1, st.path || t.id
    FROM public.teams t
    INNER JOIN subteams st ON t.parent_team_id = st.id
    WHERE st.depth < 50  -- Prevent infinite recursion (max 50 levels)
      AND NOT (t.id = ANY(st.path))  -- Prevent cycles
  )
  SELECT id FROM subteams;
$function$;