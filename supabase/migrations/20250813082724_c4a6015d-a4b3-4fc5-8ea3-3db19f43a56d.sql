-- Fix RLS policy to allow users to read their own roles
-- The current "Users can view all roles" policy might not be working correctly

-- Drop the existing view policy and recreate it
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

-- Create a new policy that explicitly allows users to view any user roles
-- This is needed for the application to function properly
CREATE POLICY "Authenticated users can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Also ensure users can read their own roles specifically
CREATE POLICY IF NOT EXISTS "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);