-- Add admin policies for all tables to allow full access

-- Holidays table - admins can do everything
CREATE POLICY "Admins can manage all holidays" 
ON public.holidays 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Profiles table - admins can do everything including delete
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Schedule entries - admins can do everything
CREATE POLICY "Admins can view all schedule entries" 
ON public.schedule_entries 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert any schedule entry" 
ON public.schedule_entries 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any schedule entry" 
ON public.schedule_entries 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any schedule entry" 
ON public.schedule_entries 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Team members - admins can do everything
CREATE POLICY "Admins can manage all team memberships" 
ON public.team_members 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teams - admins can do everything including delete
CREATE POLICY "Admins can view all teams" 
ON public.teams 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert any team" 
ON public.teams 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any team" 
ON public.teams 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any team" 
ON public.teams 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- User roles - admins can do everything
CREATE POLICY "Admins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));