-- 1) team_audit_log: enforce changed_by = auth.uid()
DROP POLICY IF EXISTS "Authenticated can insert team audit logs" ON public.team_audit_log;
CREATE POLICY "Authenticated can insert team audit logs"
ON public.team_audit_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- 2) email-screenshots bucket: make private
UPDATE storage.buckets SET public = false WHERE id = 'email-screenshots';

-- 3) user_time_allowances: remove self-write policies (admins/planners/managers retain full control via existing policies; SELECT for self remains)
DROP POLICY IF EXISTS "Users insert own allowances" ON public.user_time_allowances;
DROP POLICY IF EXISTS "Users update own allowances" ON public.user_time_allowances;

-- 4) shift_swap_requests: fix tautological partnership check
DROP POLICY IF EXISTS "Team members create swap requests" ON public.shift_swap_requests;
CREATE POLICY "Team members create swap requests"
ON public.shift_swap_requests FOR INSERT
WITH CHECK (
  (auth.uid() = requesting_user_id)
  AND (team_id IN (SELECT get_user_teams(auth.uid())))
  AND (EXISTS (
    SELECT 1 FROM public.schedule_entries se
    WHERE se.id = shift_swap_requests.target_entry_id
      AND (
        se.team_id = shift_swap_requests.team_id
        OR public.are_teams_in_partnership(shift_swap_requests.team_id, se.team_id)
      )
  ))
);

-- 5) Re-apply anon revoke defensively
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', r.schemaname, r.tablename);
  END LOOP;
END $$;
