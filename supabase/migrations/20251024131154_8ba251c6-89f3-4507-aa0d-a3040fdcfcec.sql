-- Update get_manager_accessible_teams to allow Turbine Troubleshooting managers
-- to see all Turbine Troubleshooting teams
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
  ),
  -- Check if manager has any Turbine Troubleshooting team
  has_turbine_troubleshooting AS (
    SELECT EXISTS (
      SELECT 1
      FROM all_manager_teams amt
      INNER JOIN public.teams t ON amt.team_id = t.id
      WHERE t.name ILIKE '%Turbine Troubleshooting%'
    ) AS is_turbine_manager
  ),
  -- Get all Turbine Troubleshooting teams if user is a Turbine Troubleshooting manager
  turbine_troubleshooting_teams AS (
    SELECT t.id AS team_id
    FROM public.teams t, has_turbine_troubleshooting htt
    WHERE htt.is_turbine_manager = true
      AND t.name ILIKE '%Turbine Troubleshooting%'
  ),
  -- Combine regular manager teams with Turbine Troubleshooting teams
  combined_teams AS (
    SELECT team_id FROM all_manager_teams
    UNION
    SELECT team_id FROM turbine_troubleshooting_teams
  )
  -- For each managed team, get all sub-teams recursively
  SELECT DISTINCT subteam_id
  FROM combined_teams ct
  CROSS JOIN LATERAL get_all_subteam_ids(ct.team_id) AS subteam_id;
$$;