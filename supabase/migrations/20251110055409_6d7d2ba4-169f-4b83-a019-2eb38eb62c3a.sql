-- Universal Team Hierarchy Permissions Fix
-- Separates VIEW and EDIT permissions across all teams

-- Function 1: Get teams where user is DIRECTLY a manager (non-recursive)
CREATE OR REPLACE FUNCTION public.get_directly_managed_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE tm.user_id = _manager_id
    AND tm.is_manager = true;
$$;

-- Function 2: Get teams a manager can EDIT (directly managed + all descendants)
CREATE OR REPLACE FUNCTION public.get_manager_editable_teams(_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE team_tree AS (
    -- Start with teams where user is DIRECTLY a manager
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = _manager_id
      AND tm.is_manager = true
    
    UNION
    
    -- Recursively add all descendant teams
    SELECT t.id
    FROM public.teams t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.team_id
  )
  SELECT team_id FROM team_tree;
$$;

-- Function 3: Helper to check if user can EDIT a specific team
CREATE OR REPLACE FUNCTION public.has_manager_edit_access(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _team_id IN (
    SELECT public.get_manager_editable_teams(_user_id)
  );
$$;

-- Update schedule_entries RLS policies for stricter edit permissions
-- Drop existing manager modification policies
DROP POLICY IF EXISTS "Managers and delegates can insert schedule entries for their te" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers and delegates can update schedule entries for their te" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers and delegates can delete schedule entries for their te" ON public.schedule_entries;

-- Create new INSERT policy with stricter edit permissions
CREATE POLICY "Managers can insert schedule entries for editable teams"
ON public.schedule_entries
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
  OR (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND (
      auth.uid() = user_id  -- Can always edit own schedule
      OR public.has_manager_edit_access(auth.uid(), team_id)
    )
  )
);

-- Create new UPDATE policy with stricter edit permissions
CREATE POLICY "Managers can update schedule entries for editable teams"
ON public.schedule_entries
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
  OR (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND (
      auth.uid() = user_id  -- Can always edit own schedule
      OR public.has_manager_edit_access(auth.uid(), team_id)
    )
  )
);

-- Create new DELETE policy with stricter edit permissions
CREATE POLICY "Managers can delete schedule entries for editable teams"
ON public.schedule_entries
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
  OR (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND (
      auth.uid() = user_id  -- Can always edit own schedule
      OR public.has_manager_edit_access(auth.uid(), team_id)
    )
  )
);