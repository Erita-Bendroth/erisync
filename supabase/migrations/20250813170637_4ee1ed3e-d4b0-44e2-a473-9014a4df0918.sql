-- Fix RLS policies with unique names to ensure admins have proper access

-- Drop existing policies and create new ones with different names
DROP POLICY IF EXISTS "Admin and user access to roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and team member access" ON public.team_members;

-- Create new policies for user_roles with admin access
CREATE POLICY "Roles visibility policy" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id
);

-- Create new policies for team_members with admin access  
CREATE POLICY "Team membership visibility policy" 
ON public.team_members 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id OR
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);