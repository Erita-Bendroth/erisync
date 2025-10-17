-- Ensure no permissive ALL policies exist that could allow public access

-- For user_oauth_tokens: Drop the ALL policy and create separate policies
DROP POLICY IF EXISTS "Users can only access their own OAuth tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "auth_users_own_oauth_tokens" ON public.user_oauth_tokens;

-- Create explicit INSERT, UPDATE, DELETE policies for user_oauth_tokens
CREATE POLICY "auth_oauth_tokens_insert_v2"
ON public.user_oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "auth_oauth_tokens_update_v2"
ON public.user_oauth_tokens
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "auth_oauth_tokens_delete_v2"
ON public.user_oauth_tokens
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- For team_view_favorites: Drop ALL policy and create separate policies
DROP POLICY IF EXISTS "Users can only access their own favorites" ON public.team_view_favorites;
DROP POLICY IF EXISTS "auth_users_own_favorites" ON public.team_view_favorites;

-- Create explicit policies for team_view_favorites
CREATE POLICY "auth_favorites_select_v2"
ON public.team_view_favorites
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  )
);

CREATE POLICY "auth_favorites_insert_v2"
ON public.team_view_favorites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "auth_favorites_update_v2"
ON public.team_view_favorites
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "auth_favorites_delete_v2"
ON public.team_view_favorites
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);