-- ============================================
-- SECURITY FIX: Tighten RLS policies to require authentication
-- Using exact policy names from database
-- ============================================

-- Fix 1: teams table - Update existing policy
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;
DROP POLICY IF EXISTS "All authenticated users can view teams" ON public.teams;

CREATE POLICY "auth_users_view_teams"
ON public.teams
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix 2: team_members - Replace with authenticated policy
DROP POLICY IF EXISTS "Team members can view their team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view members of their own teams" ON public.team_members;
DROP POLICY IF EXISTS "Managers can view team_members" ON public.team_members;

CREATE POLICY "auth_users_view_team_members"
ON public.team_members
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    is_in_same_team(auth.uid(), team_id) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix 3: user_roles - Require authentication
DROP POLICY IF EXISTS "Managers can view team member roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles with proper authorization" ON public.user_roles;

CREATE POLICY "auth_users_view_roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND user_id IN (
      SELECT tm.user_id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() AND is_manager = true
      )
    ))
  )
);

-- Fix 4: manager_delegations - Require authentication
DROP POLICY IF EXISTS "Managers can view their own delegations" ON public.manager_delegations;
DROP POLICY IF EXISTS "Authorized users can view relevant delegations" ON public.manager_delegations;

CREATE POLICY "auth_users_view_delegations"
ON public.manager_delegations
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = manager_id OR
    auth.uid() = delegate_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 5: Audit logs - Require authentication for admins/planners only
DROP POLICY IF EXISTS "Admins and planners can view team audit logs" ON public.team_audit_log;
DROP POLICY IF EXISTS "Only admins and planners can view team audit logs" ON public.team_audit_log;

CREATE POLICY "auth_admins_planners_view_team_audit"
ON public.team_audit_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

DROP POLICY IF EXISTS "Admins and planners can view delegation audit logs" ON public.delegation_audit_log;
DROP POLICY IF EXISTS "Only admins and planners can view delegation audit logs" ON public.delegation_audit_log;

CREATE POLICY "auth_admins_planners_view_delegation_audit"
ON public.delegation_audit_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

DROP POLICY IF EXISTS "Admins and planners can view all profile access logs" ON public.profile_access_log;
DROP POLICY IF EXISTS "Only admins and planners can view profile access logs" ON public.profile_access_log;

CREATE POLICY "auth_admins_planners_view_profile_access"
ON public.profile_access_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 6: OAuth tokens - Only token owner can access
DROP POLICY IF EXISTS "Users can manage their own OAuth tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "Users can only access their own OAuth tokens" ON public.user_oauth_tokens;

CREATE POLICY "auth_users_own_oauth_tokens"
ON public.user_oauth_tokens
FOR ALL
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all OAuth tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "Admins can view OAuth tokens" ON public.user_oauth_tokens;

CREATE POLICY "auth_admins_view_oauth_tokens"
ON public.user_oauth_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Fix 7: profiles - Require authentication
DROP POLICY IF EXISTS "Users can view full profiles with team restrictions" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles with restrictions" ON public.profiles;

CREATE POLICY "auth_users_view_profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm1.is_manager = true
      AND tm2.user_id = profiles.user_id
    ))
  )
);

-- Fix 8: schedule_entries - Require authentication
DROP POLICY IF EXISTS "Users can view their own entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Authenticated users can view relevant schedule entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers can view team and subteam schedules" ON public.schedule_entries;

CREATE POLICY "auth_users_view_schedules"
ON public.schedule_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND 
      team_id IN (SELECT get_manager_accessible_teams(auth.uid()))) OR
    (has_role(auth.uid(), 'teammember'::app_role) AND 
      team_id IN (SELECT get_user_teams(auth.uid())))
  )
);

-- Fix 9: vacation_requests - Require authentication
DROP POLICY IF EXISTS "Users can view their own vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Authenticated users can view relevant vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Managers and delegates can view vacation requests for their tea" ON public.vacation_requests;

CREATE POLICY "auth_users_view_vacation_requests"
ON public.vacation_requests
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND 
      has_manager_access(auth.uid(), team_id))
  )
);

-- Fix 10: holidays - Require authentication
DROP POLICY IF EXISTS "All authenticated users can view public holidays" ON public.holidays;
DROP POLICY IF EXISTS "Authenticated users can view relevant holidays" ON public.holidays;

CREATE POLICY "auth_users_view_holidays"
ON public.holidays
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    user_id IS NULL OR
    user_id = auth.uid() OR
    (has_role(auth.uid(), 'manager'::app_role) AND (
      user_id IS NULL OR user_id = auth.uid() OR user_id IN (
        SELECT tm.user_id FROM team_members tm
        WHERE tm.team_id IN (
          SELECT team_id FROM team_members
          WHERE user_id = auth.uid() AND is_manager = true
        )
      )
    )) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 11: cron_job_logs - Require authentication
DROP POLICY IF EXISTS "Only admins and planners can view cron logs" ON public.cron_job_logs;
DROP POLICY IF EXISTS "Only authenticated admins and planners can view cron logs" ON public.cron_job_logs;

CREATE POLICY "auth_admins_planners_view_cron_logs"
ON public.cron_job_logs
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 12: team_view_favorites - Ensure authentication
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.team_view_favorites;
DROP POLICY IF EXISTS "Users can only access their own favorites" ON public.team_view_favorites;

CREATE POLICY "auth_users_own_favorites"
ON public.team_view_favorites
FOR ALL
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);