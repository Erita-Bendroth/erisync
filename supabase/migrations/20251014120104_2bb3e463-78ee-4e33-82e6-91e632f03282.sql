-- Add parent_team_id to teams table for hierarchical structure
ALTER TABLE public.teams ADD COLUMN parent_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Create index for better performance on hierarchy queries
CREATE INDEX idx_teams_parent_team_id ON public.teams(parent_team_id);

-- Function to get all sub-teams recursively for a given team
CREATE OR REPLACE FUNCTION public.get_all_subteam_ids(_team_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE subteams AS (
    -- Start with the given team
    SELECT id FROM public.teams WHERE id = _team_id
    UNION
    -- Recursively find all child teams
    SELECT t.id FROM public.teams t
    INNER JOIN subteams st ON t.parent_team_id = st.id
  )
  SELECT id FROM subteams;
$function$;

-- Function to get all teams a manager can access (including sub-teams)
CREATE OR REPLACE FUNCTION public.get_manager_accessible_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Get all teams where user is a manager
  WITH manager_teams AS (
    SELECT team_id FROM public.team_members
    WHERE user_id = _manager_id AND is_manager = true
  )
  -- For each managed team, get all sub-teams recursively
  SELECT DISTINCT subteam_id
  FROM manager_teams mt
  CROSS JOIN LATERAL get_all_subteam_ids(mt.team_id) AS subteam_id;
$function$;

-- Update schedule_entries RLS policy for managers to include sub-teams
DROP POLICY IF EXISTS "Managers can view managed team schedules and availability from" ON public.schedule_entries;

CREATE POLICY "Managers can view team and subteam schedules"
ON public.schedule_entries
FOR SELECT
USING (
  has_role(auth.uid(), 'planner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  (auth.uid() = user_id) OR
  -- Managers can view schedules from their teams and all sub-teams
  (has_role(auth.uid(), 'manager'::app_role) AND team_id IN (
    SELECT get_manager_accessible_teams(auth.uid())
  ))
);