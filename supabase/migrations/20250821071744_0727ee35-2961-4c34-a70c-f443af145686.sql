-- Fix remaining function search path issues

-- Update all existing functions with missing search_path
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_profile_access(_profile_user_id uuid, _access_type text DEFAULT 'SELECT'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.validate_manager_team_access(_manager_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.verify_user_password(_email text, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_exists boolean;
BEGIN
  -- This function will be used to verify current password before allowing changes
  -- We'll implement the actual verification in the edge function for security
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_temporary_password(_user_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  temp_password TEXT := 'VestasTemp2025!';
BEGIN
  -- This function will be called by the edge function to verify the password
  -- The actual password verification will happen in the edge function
  -- This function just stores the temporary password for comparison
  RETURN _password = temp_password;
END;
$$;