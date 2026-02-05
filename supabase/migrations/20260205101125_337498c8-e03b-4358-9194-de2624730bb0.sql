-- Drop and recreate the manager policy for team_members to use hierarchical access
DROP POLICY IF EXISTS "managers_manage_own_team_members" ON public.team_members;

CREATE POLICY "managers_manage_own_team_members" ON public.team_members
FOR ALL
TO authenticated
USING (
  public.has_manager_edit_access(auth.uid(), team_id)
)
WITH CHECK (
  public.has_manager_edit_access(auth.uid(), team_id)
);