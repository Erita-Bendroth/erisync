-- Allow managers to view schedule entries across all teams (UI will restrict details)
DROP POLICY IF EXISTS "Managers can view all schedule entries" ON schedule_entries;

CREATE POLICY "Managers can view all schedule entries"
ON schedule_entries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = user_id
);