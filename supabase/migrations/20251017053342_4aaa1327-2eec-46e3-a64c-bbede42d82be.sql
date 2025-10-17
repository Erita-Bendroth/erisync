-- Update get_manager_accessible_teams to include delegated teams
CREATE OR REPLACE FUNCTION public.get_manager_accessible_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Get all teams where user is a direct manager
  WITH direct_manager_teams AS (
    SELECT team_id FROM public.team_members
    WHERE user_id = _manager_id AND is_manager = true
  ),
  -- Get all teams where user has delegated manager access
  delegated_teams AS (
    SELECT DISTINCT tm.team_id
    FROM public.manager_delegations md
    INNER JOIN public.team_members tm ON md.manager_id = tm.user_id
    WHERE md.delegate_id = _manager_id
      AND md.status = 'active'
      AND now() BETWEEN md.start_date AND md.end_date
      AND tm.is_manager = true
  ),
  -- Combine both direct and delegated teams
  all_manager_teams AS (
    SELECT team_id FROM direct_manager_teams
    UNION
    SELECT team_id FROM delegated_teams
  )
  -- For each managed team (direct or delegated), get all sub-teams recursively
  SELECT DISTINCT subteam_id
  FROM all_manager_teams amt
  CROSS JOIN LATERAL get_all_subteam_ids(amt.team_id) AS subteam_id;
$$;