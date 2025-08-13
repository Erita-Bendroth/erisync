-- Clean up all existing policies and create new working ones

-- Drop ALL existing policies for these tables
DROP POLICY IF EXISTS "User roles access policy" ON public.user_roles;
DROP POLICY IF EXISTS "Team members access policy" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow initial admin setup and planner management" ON public.user_roles;
DROP POLICY IF EXISTS "Planners can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Planners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and planners can manage team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage all team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Only planners can manage team memberships" ON public.team_members;

-- Create brand new working policies
CREATE POLICY "view_user_roles_2024" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() IS NULL OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id
);

CREATE POLICY "view_team_members_2024" 
ON public.team_members 
FOR SELECT 
USING (
  auth.uid() IS NULL OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id OR
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Restore the necessary management policies
CREATE POLICY "manage_user_roles_admin" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "manage_user_roles_planner" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'planner'::app_role));
CREATE POLICY "update_user_roles_planner" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'planner'::app_role));
CREATE POLICY "delete_user_roles_planner" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "manage_team_members_admin" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "manage_team_members_planner" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'planner'::app_role)) WITH CHECK (has_role(auth.uid(), 'planner'::app_role));