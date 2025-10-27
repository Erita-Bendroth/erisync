-- Fix get_manager_accessible_teams to remove Turbine Troubleshooting blanket access
-- Managers should ONLY access teams they directly manage + sub-teams

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
  -- For each managed team, get all sub-teams recursively
  SELECT DISTINCT subteam_id
  FROM all_manager_teams ct
  CROSS JOIN LATERAL get_all_subteam_ids(ct.team_id) AS subteam_id;
$$;

COMMENT ON FUNCTION public.get_manager_accessible_teams IS 'Returns all teams a manager has access to: directly managed teams + their sub-teams + delegated teams + their sub-teams. Removed blanket Turbine Troubleshooting access.';