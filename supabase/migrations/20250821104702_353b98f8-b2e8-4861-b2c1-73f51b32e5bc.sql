-- Fix infinite recursion in team_members RLS by using a SECURITY DEFINER helper

-- 1) Helper function to get managed team ids for a user
CREATE OR REPLACE FUNCTION public.get_managed_team_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE tm.user_id = _uid AND tm.is_manager = true;
$$;

-- 2) Recreate the SELECT policy for team_members to avoid self-referencing subqueries
DROP POLICY IF EXISTS "Managers can view their team members" ON public.team_members;

CREATE POLICY "Managers can view their team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  -- Users can see their own memberships
  auth.uid() = user_id
  OR
  -- Admins and planners can see all
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR
  -- Managers can see rows for teams they manage (via SECURITY DEFINER function)
  (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IN (SELECT public.get_managed_team_ids(auth.uid()))
  )
);
