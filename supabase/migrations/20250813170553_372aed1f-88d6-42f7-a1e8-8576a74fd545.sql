-- Fix RLS policies to ensure admins have proper access to all user data

-- Drop and recreate user_roles policy with proper admin access
DROP POLICY IF EXISTS "Secure user roles access" ON public.user_roles;

CREATE POLICY "Admin and user access to roles" 
ON public.user_roles 
FOR SELECT 
USING (
  -- Admins can see all roles
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Planners can see all roles 
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Users can see their own roles
  auth.uid() = user_id
);

-- Drop and recreate team_members policy with proper admin access
DROP POLICY IF EXISTS "Secure team members access" ON public.team_members;

CREATE POLICY "Admin and team member access" 
ON public.team_members 
FOR SELECT 
USING (
  -- Admins can see all team memberships
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Planners can see all team memberships
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Users can see their own team memberships
  auth.uid() = user_id OR
  -- Users can see other members of teams they belong to
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);