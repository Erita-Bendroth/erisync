
-- Allow team members to view profiles of managers in their team
-- This is needed so users can see who their manager is when submitting vacation requests

CREATE POLICY "Team members can view manager profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow viewing profiles of users who are managers in any of the viewer's teams
  EXISTS (
    SELECT 1 
    FROM public.team_members tm_viewer
    INNER JOIN public.team_members tm_manager ON tm_viewer.team_id = tm_manager.team_id
    WHERE tm_viewer.user_id = auth.uid()
      AND tm_manager.user_id = profiles.user_id
      AND tm_manager.is_manager = true
  )
);

-- Also allow viewing profiles of managers in parent teams (for approval workflows)
CREATE POLICY "Team members can view parent team manager profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow viewing profiles of managers in parent teams
  EXISTS (
    SELECT 1
    FROM public.team_members tm_viewer
    INNER JOIN public.teams t ON tm_viewer.team_id = t.id
    INNER JOIN public.team_members tm_parent_manager ON t.parent_team_id = tm_parent_manager.team_id
    WHERE tm_viewer.user_id = auth.uid()
      AND tm_parent_manager.user_id = profiles.user_id
      AND tm_parent_manager.is_manager = true
  )
);
