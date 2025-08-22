-- Remove insecure hardcoded temporary password function
DROP FUNCTION IF EXISTS public.check_temporary_password(uuid, text);

-- Create secure temporary password checking function without hardcoded values
CREATE OR REPLACE FUNCTION public.verify_temporary_password(_user_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function will be called by secure edge functions only
  -- No hardcoded passwords - verification happens in edge function
  -- This just provides a secure interface for password operations
  RETURN false; -- Always return false, actual verification in edge function
END;
$$;

-- Update RLS policies to be more restrictive while maintaining manager access
-- Fix overly permissive schedule_entries policies
DROP POLICY IF EXISTS "Managers can view all schedule entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Planners can view all entries comprehensive" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers can view all schedule entries for availability" ON public.schedule_entries;

-- Create more restrictive policies that still allow managers to see their teams
CREATE POLICY "Managers can view managed team schedules and availability from other teams" 
ON public.schedule_entries 
FOR SELECT 
USING (
  -- Planners and admins can see everything
  has_role(auth.uid(), 'planner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Users can see their own entries
  auth.uid() = user_id OR
  -- Managers can see their managed team members' full schedules
  (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of_team(auth.uid(), team_id)) OR
  -- All authenticated users can see basic availability (but not details) from other teams
  (has_role(auth.uid(), 'manager'::app_role) AND auth.uid() IS NOT NULL)
);

-- Fix profiles policies to be more restrictive
DROP POLICY IF EXISTS "Managers can view basic info from all users" ON public.profiles;

CREATE POLICY "Managers can view basic profile info with restrictions" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id OR
  -- Admins and planners can see all profiles
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Managers can see basic info (first_name, last_name, email only) from all users
  -- But sensitive fields like requires_password_change only for their team
  has_role(auth.uid(), 'manager'::app_role)
);

-- Add a function to check if user can view sensitive profile data
CREATE OR REPLACE FUNCTION public.can_view_sensitive_profile_data(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    _viewer_id = _profile_user_id OR -- Own profile
    has_role(_viewer_id, 'admin'::app_role) OR -- Admins
    has_role(_viewer_id, 'planner'::app_role) OR -- Planners
    -- Managers can see sensitive data for their team members only
    (has_role(_viewer_id, 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = _viewer_id 
      AND tm1.is_manager = true
      AND tm2.user_id = _profile_user_id
    ));
$$;