-- Fix: Remove admin ability to view all OAuth tokens
-- Admins have no legitimate need to see users' OAuth tokens
-- This reduces risk if an admin account is compromised

-- Drop the existing SELECT policy that allows admins to view all tokens
DROP POLICY IF EXISTS "auth_oauth_tokens_view_v2" ON public.user_oauth_tokens;

-- Create a more restrictive policy: users can ONLY view their own tokens
CREATE POLICY "users_view_own_oauth_tokens" ON public.user_oauth_tokens
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);