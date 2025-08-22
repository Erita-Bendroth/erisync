-- Fix function search paths for security compliance
-- Update existing functions to include SET search_path

-- Fix the log_profile_access function
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

-- Fix the validate_manager_team_access function
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