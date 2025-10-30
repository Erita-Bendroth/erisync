-- Fix profiles RLS policy to support team hierarchy
-- Managers of parent teams should be able to view profiles of users in child teams

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Managers view team member profiles" ON public.profiles;

-- Create new hierarchy-aware policy that uses get_manager_accessible_teams
CREATE POLICY "Managers view accessible team member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    user_id IN (
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT get_manager_accessible_teams(auth.uid())
      )
    )
  )
);