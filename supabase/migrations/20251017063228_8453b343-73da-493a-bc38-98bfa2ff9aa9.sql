-- ============================================
-- SECURITY FIX: Add authentication requirements to all policies
-- This migration tightens RLS policies without breaking functionality
-- ============================================

-- Fix 1: Ensure teams table requires authentication for all access
-- Drop and recreate the "All authenticated users can view teams" policy with explicit auth check
DROP POLICY IF EXISTS "All authenticated users can view teams" ON public.teams;

CREATE POLICY "Authenticated users can view teams"
ON public.teams
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

-- Fix 2: Ensure team_members requires authentication
-- The existing policies should be fine, but let's add an explicit baseline policy
DROP POLICY IF EXISTS "Team members can view members of their own teams" ON public.team_members;

CREATE POLICY "Team members can view their team members"
ON public.team_members
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see members of their own teams
    is_in_same_team(auth.uid(), team_id) OR
    -- Managers and planners can see all team members
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix 3: Ensure user_roles requires authentication for viewing
-- Current policy allows managers to view team member roles, but we need baseline auth
DROP POLICY IF EXISTS "Managers can view team member roles" ON public.user_roles;

CREATE POLICY "Users can view roles with proper authorization"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see their own roles
    auth.uid() = user_id OR
    -- Admins can see all roles
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Planners can see all roles
    has_role(auth.uid(), 'planner'::app_role) OR
    -- Managers can view roles of their team members
    (has_role(auth.uid(), 'manager'::app_role) AND (user_id IN (
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_members.team_id
        FROM team_members
        WHERE team_members.user_id = auth.uid() AND team_members.is_manager = true
      )
    )))
  )
);

-- Fix 4: Tighten manager_delegations access
-- Ensure only authenticated users with proper roles can view delegations
DROP POLICY IF EXISTS "Managers can view their own delegations" ON public.manager_delegations;

CREATE POLICY "Authorized users can view relevant delegations"
ON public.manager_delegations
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Manager can view their own delegations
    auth.uid() = manager_id OR
    -- Delegate can view delegations where they are the delegate
    auth.uid() = delegate_id OR
    -- Admins and planners can view all delegations
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 5: Ensure audit logs are only accessible to admins and planners (already exist but verify)
-- These policies should already be correct, but let's ensure they require authentication

-- team_audit_log
DROP POLICY IF EXISTS "Admins and planners can view team audit logs" ON public.team_audit_log;

CREATE POLICY "Only admins and planners can view team audit logs"
ON public.team_audit_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- delegation_audit_log
DROP POLICY IF EXISTS "Admins and planners can view delegation audit logs" ON public.delegation_audit_log;

CREATE POLICY "Only admins and planners can view delegation audit logs"
ON public.delegation_audit_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- profile_access_log
DROP POLICY IF EXISTS "Admins and planners can view all profile access logs" ON public.profile_access_log;
DROP POLICY IF EXISTS "Only admins and planners can view profile access logs" ON public.profile_access_log;

CREATE POLICY "Only admins and planners can view profile access logs"
ON public.profile_access_log
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 6: Ensure user_oauth_tokens are only accessible by token owner
DROP POLICY IF EXISTS "Users can manage their own OAuth tokens" ON public.user_oauth_tokens;

CREATE POLICY "Users can only access their own OAuth tokens"
ON public.user_oauth_tokens
FOR ALL
USING (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
);

-- Keep admin view policy but ensure authentication
DROP POLICY IF EXISTS "Admins can view all OAuth tokens" ON public.user_oauth_tokens;

CREATE POLICY "Admins can view OAuth tokens"
ON public.user_oauth_tokens
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 7: Ensure profiles table has proper authentication
-- The existing policies should be fine, but let's verify the baseline
DROP POLICY IF EXISTS "Users can view full profiles with team restrictions" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles with restrictions"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see their own profile
    auth.uid() = user_id OR
    -- Admins can see all profiles
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Planners can see all profiles
    has_role(auth.uid(), 'planner'::app_role) OR
    -- Managers can view profiles of their team members
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1
      FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = profiles.user_id
    ))
  )
);

-- Fix 8: Ensure schedule_entries require authentication
-- Existing policies should be fine, but let's add explicit auth checks
DROP POLICY IF EXISTS "Users can view their own entries" ON public.schedule_entries;

CREATE POLICY "Authenticated users can view relevant schedule entries"
ON public.schedule_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can view their own entries
    auth.uid() = user_id OR
    -- Admins can view all
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Planners can view all
    has_role(auth.uid(), 'planner'::app_role) OR
    -- Managers can view their team's schedules
    (has_role(auth.uid(), 'manager'::app_role) AND (
      team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
    )) OR
    -- Team members can view their team schedules
    (has_role(auth.uid(), 'teammember'::app_role) AND (
      team_id IN (SELECT get_user_teams(auth.uid()))
    ))
  )
);

-- Fix 9: Ensure vacation_requests require authentication
DROP POLICY IF EXISTS "Users can view their own vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Managers and delegates can view vacation requests for their tea" ON public.vacation_requests;

CREATE POLICY "Authenticated users can view relevant vacation requests"
ON public.vacation_requests
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can view their own requests
    auth.uid() = user_id OR
    -- Admins and planners can view all
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    -- Managers can view requests for their teams (including delegated access)
    (has_role(auth.uid(), 'manager'::app_role) AND has_manager_access(auth.uid(), team_id))
  )
);

-- Fix 10: Ensure holidays table requires authentication
DROP POLICY IF EXISTS "All authenticated users can view public holidays" ON public.holidays;

CREATE POLICY "Authenticated users can view relevant holidays"
ON public.holidays
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Public holidays with no user_id
    (user_id IS NULL) OR
    -- User's own custom holidays
    (user_id = auth.uid()) OR
    -- Managers can view team member holidays
    (has_role(auth.uid(), 'manager'::app_role) AND (
      user_id IS NULL OR 
      user_id = auth.uid() OR 
      user_id IN (
        SELECT tm.user_id
        FROM team_members tm
        WHERE tm.team_id IN (
          SELECT team_members.team_id
          FROM team_members
          WHERE team_members.user_id = auth.uid() AND team_members.is_manager = true
        )
      )
    )) OR
    -- Admins and planners can view all
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 11: Ensure cron_job_logs require authentication
DROP POLICY IF EXISTS "Only admins and planners can view cron logs" ON public.cron_job_logs;

CREATE POLICY "Only authenticated admins and planners can view cron logs"
ON public.cron_job_logs
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

-- Fix 12: Ensure team_view_favorites require authentication (new table from previous feature)
-- This table should only be accessible by the owner
CREATE POLICY "Users can only access their own favorites"
ON public.team_view_favorites
FOR ALL
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Comment: Extensions in public schema warning
-- This is a Supabase platform configuration that cannot be changed via migration
-- It's a warning, not a critical security issue for this application

-- Comment: Leaked password protection
-- This must be enabled in Supabase Dashboard -> Authentication -> Password Protection
-- Cannot be set via SQL migration

-- Comment: Postgres version upgrade
-- This must be done via Supabase Dashboard -> Settings -> Infrastructure
-- Cannot be done via SQL migration