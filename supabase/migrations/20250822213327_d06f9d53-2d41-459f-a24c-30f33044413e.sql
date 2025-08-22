-- Fix critical security issue: Restrict manager access to only their team members

-- Drop the overly permissive manager policies on profiles table
DROP POLICY IF EXISTS "Managers can view all profiles for availability" ON public.profiles;
DROP POLICY IF EXISTS "Planners can view team-assigned profiles only" ON public.profiles;

-- Create proper manager access policy for profiles
CREATE POLICY "Managers can view team member profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role) 
  OR (auth.uid() = user_id)
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND user_id IN (
      SELECT tm.user_id 
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() AND is_manager = true
      )
    )
  )
);

-- Update holidays table RLS to restrict manager access to team members only
DROP POLICY IF EXISTS "holidays_all_access" ON public.holidays;

CREATE POLICY "Users can manage their own holidays" 
ON public.holidays 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and planners can manage all holidays" 
ON public.holidays 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
);

CREATE POLICY "Managers can view team member holidays only" 
ON public.holidays 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    user_id IS NULL -- Public holidays
    OR user_id = auth.uid() -- Own holidays
    OR user_id IN (
      SELECT tm.user_id 
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() AND is_manager = true
      )
    )
  )
);

CREATE POLICY "All authenticated users can view public holidays" 
ON public.holidays 
FOR SELECT 
USING (user_id IS NULL AND auth.uid() IS NOT NULL);

-- Update profile_access_log to restrict manager access
DROP POLICY IF EXISTS "Admins and planners can view profile access logs" ON public.profile_access_log;

CREATE POLICY "Admins and planners can view all profile access logs" 
ON public.profile_access_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role)
);

CREATE POLICY "Managers can view access logs for their team members only" 
ON public.profile_access_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    accessed_by = auth.uid() -- Logs of their own access
    OR profile_user_id IN (
      SELECT tm.user_id 
      FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() AND is_manager = true
      )
    )
  )
);

-- Ensure security definer functions have explicit search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE user_id = _user_id AND team_id = _team_id AND is_manager = true
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_teams(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.get_managed_team_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE tm.user_id = _uid AND tm.is_manager = true
$$;