-- Fix PUBLIC_USER_DATA: Secure profiles table
-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles with restrictions" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles with restrictions" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "auth_users_view_profiles" ON public.profiles;

-- Create single secure SELECT policy for profiles requiring authentication
CREATE POLICY "authenticated_users_view_profiles_secure"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = profiles.user_id
    ))
  )
);

-- Fix PUBLIC_SENSITIVE_DATA: Secure user_oauth_tokens table
-- Drop all existing SELECT policies on user_oauth_tokens
DROP POLICY IF EXISTS "Admins can view OAuth tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "auth_admins_view_oauth_tokens" ON public.user_oauth_tokens;

-- Create single secure SELECT policy for OAuth tokens requiring strict ownership
CREATE POLICY "authenticated_users_own_oauth_tokens_secure"
ON public.user_oauth_tokens
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id OR 
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix PUBLIC_BUSINESS_DATA: Secure vacation_requests table
-- Drop all existing SELECT policies on vacation_requests
DROP POLICY IF EXISTS "Admins and planners can view all vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Authenticated users can view relevant vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "auth_users_view_vacation_requests" ON public.vacation_requests;

-- Create single secure SELECT policy for vacation requests requiring proper authorization
CREATE POLICY "authenticated_users_view_vacation_requests_secure"
ON public.vacation_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND has_manager_access(auth.uid(), team_id))
  )
);