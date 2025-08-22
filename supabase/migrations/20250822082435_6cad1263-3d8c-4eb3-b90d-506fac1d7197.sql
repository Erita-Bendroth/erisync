-- Update Supabase config to enable JWT verification for sensitive functions
-- This will be handled in config.toml update

-- Update RLS policies to fix security issues
-- Update manager access policy to be more restrictive
DROP POLICY IF EXISTS "Managers can view team member profiles only" ON public.profiles;

CREATE POLICY "Managers can view team member profiles only" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  (auth.uid() = user_id) OR 
  (has_role(auth.uid(), 'manager'::app_role) AND validate_manager_team_access(auth.uid(), user_id))
);

-- Update functions to include search_path for security
CREATE OR REPLACE FUNCTION public.log_profile_access(_profile_user_id uuid, _access_type text DEFAULT 'SELECT'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.validate_manager_team_access(_manager_id uuid, _target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;