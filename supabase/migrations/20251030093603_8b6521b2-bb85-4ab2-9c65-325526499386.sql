-- Update has_manager_access to include hierarchical checks
-- This allows managers to edit schedules for all teams in their hierarchy, not just direct teams
CREATE OR REPLACE FUNCTION public.has_manager_access(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _team_id IN (
    SELECT get_manager_accessible_teams(_user_id)
  );
$$;

-- Add comment explaining the change
COMMENT ON FUNCTION public.has_manager_access IS 
'Check if user has manager access to a team via direct management, hierarchy, or delegation. 
Uses get_manager_accessible_teams() which includes all sub-teams recursively.';