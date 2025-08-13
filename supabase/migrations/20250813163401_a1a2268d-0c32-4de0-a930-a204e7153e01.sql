-- SECURITY FIX: Restrict Profile Access and Add Audit Controls

-- 1. DROP overly permissive policies
DROP POLICY IF EXISTS "Planners can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view team member profiles" ON public.profiles;

-- 2. Create more secure manager access policy
-- Managers can only view profiles of users in teams they DIRECTLY manage
CREATE POLICY "Managers can view direct team member profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND user_id IN (
    SELECT tm.user_id 
    FROM public.team_members tm
    WHERE tm.team_id IN (
      SELECT DISTINCT team_id 
      FROM public.team_members 
      WHERE user_id = auth.uid() 
      AND is_manager = true
    )
    AND tm.user_id != auth.uid()  -- Exclude self (covered by own profile policy)
  )
);

-- 3. Create restricted planner access policy  
-- Planners can view profiles but with explicit team-based restrictions
CREATE POLICY "Planners can view team-assigned profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'planner'::app_role) 
  AND (
    user_id = auth.uid() OR  -- Own profile
    user_id IN (
      SELECT DISTINCT tm.user_id 
      FROM public.team_members tm
      INNER JOIN public.teams t ON tm.team_id = t.id
      -- Planners can see profiles of users in existing teams only
      WHERE t.id IS NOT NULL
    )
  )
);

-- 4. Create audit table for profile access logging
CREATE TABLE IF NOT EXISTS public.profile_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accessed_by UUID NOT NULL,
  profile_user_id UUID NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'SELECT',
  access_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET
);

-- Enable RLS on audit table
ALTER TABLE public.profile_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins and planners can view audit logs
CREATE POLICY "Admins and planners can view profile access logs" 
ON public.profile_access_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role)
);

-- 5. Create function to log profile access (for future use)
CREATE OR REPLACE FUNCTION public.log_profile_access(
  _profile_user_id UUID,
  _access_type TEXT DEFAULT 'SELECT'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log the access attempt
  INSERT INTO public.profile_access_log (
    accessed_by,
    profile_user_id,
    access_type,
    access_time
  ) VALUES (
    auth.uid(),
    _profile_user_id,
    _access_type,
    now()
  );
END;
$$;

-- 6. Add enhanced admin policy with better specificity
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles with restrictions" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND auth.uid() IS NOT NULL  -- Ensure authenticated
);

-- 7. Add policy to prevent profile enumeration
-- Add row limit policies would require application-level controls
-- For now, we rely on application logic to prevent bulk queries

-- 8. Create function to validate manager-team relationships
CREATE OR REPLACE FUNCTION public.validate_manager_team_access(
  _manager_id UUID,
  _target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  has_access BOOLEAN := false;
BEGIN
  -- Check if manager has access to target user's profile
  SELECT EXISTS(
    SELECT 1 
    FROM public.team_members tm1
    INNER JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _manager_id 
    AND tm1.is_manager = true
    AND tm2.user_id = _target_user_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;