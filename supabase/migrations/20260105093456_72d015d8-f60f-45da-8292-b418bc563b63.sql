-- Create RLS policy allowing managers to manage (INSERT, UPDATE, DELETE) their own team members
CREATE POLICY "managers_manage_own_team_members" ON public.team_members
FOR ALL
USING (
  -- Manager must be managing this specific team
  public.is_manager_of_team(auth.uid(), team_id)
)
WITH CHECK (
  -- For INSERT/UPDATE, also verify they manage this team
  public.is_manager_of_team(auth.uid(), team_id)
);