
-- 1) profiles: remove email column read access from regular roles
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (email) ON public.profiles TO service_role;

-- 2) notifications: tighten insert
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Users can create own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3) schedule_change_log
DROP POLICY IF EXISTS "System can insert schedule change logs" ON public.schedule_change_log;
CREATE POLICY "Users can insert own schedule change logs"
  ON public.schedule_change_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- 4) roster_activity_log
DROP POLICY IF EXISTS "System can insert activity logs" ON public.roster_activity_log;
CREATE POLICY "Authenticated can insert roster activity logs"
  ON public.roster_activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5) delegation_audit_log
DROP POLICY IF EXISTS "System can insert delegation audit logs" ON public.delegation_audit_log;
CREATE POLICY "Authenticated can insert delegation audit logs"
  ON public.delegation_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = performed_by);

-- 6) team_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.team_audit_log;
CREATE POLICY "Authenticated can insert team audit logs"
  ON public.team_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7) user_roles: restrict planner inserts
DROP POLICY IF EXISTS planner_manage_roles ON public.user_roles;
CREATE POLICY planner_assign_teammember_role
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'planner'::app_role)
    AND role = 'teammember'::app_role
    AND user_id <> auth.uid()
  );

-- 8) search_history insert/delete policies
CREATE POLICY "Users can insert own search history"
  ON public.search_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own search history"
  ON public.search_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9) shift_time_definitions: managers can't touch global defs
DROP POLICY IF EXISTS "Managers can manage their team shift time definitions" ON public.shift_time_definitions;
CREATE POLICY "Managers manage team shift time definitions"
  ON public.shift_time_definitions FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IS NOT NULL
    AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IS NOT NULL
    AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  );

-- 10) email-screenshots storage: enforce ownership
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view screenshots" ON storage.objects;
CREATE POLICY "Users can upload own screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'email-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can view own screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'email-screenshots'
    AND owner = auth.uid()
  );
