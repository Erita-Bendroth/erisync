-- Drop all remaining policies by exact names and create simple new ones

-- Check and drop all existing policies for user_roles
DROP POLICY IF EXISTS "view_user_roles_2024" ON public.user_roles;
DROP POLICY IF EXISTS "manage_user_roles_admin" ON public.user_roles;
DROP POLICY IF EXISTS "manage_user_roles_planner" ON public.user_roles;
DROP POLICY IF EXISTS "update_user_roles_planner" ON public.user_roles;
DROP POLICY IF EXISTS "delete_user_roles_planner" ON public.user_roles;

-- Check and drop all existing policies for team_members  
DROP POLICY IF EXISTS "view_team_members_2024" ON public.team_members;
DROP POLICY IF EXISTS "manage_team_members_admin" ON public.team_members;
DROP POLICY IF EXISTS "manage_team_members_planner" ON public.team_members;

-- Create completely new policies with unique names
CREATE POLICY "select_roles_final" ON public.user_roles FOR SELECT USING (
  auth.uid() IS NULL OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id
);

CREATE POLICY "select_teams_final" ON public.team_members FOR SELECT USING (
  auth.uid() IS NULL OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id
);

-- Add basic management policies
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_manage_teams" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "planner_manage_roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'planner'::app_role));
CREATE POLICY "planner_manage_teams" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'planner'::app_role));