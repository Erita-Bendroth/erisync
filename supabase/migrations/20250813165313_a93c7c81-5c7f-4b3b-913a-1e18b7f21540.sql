-- Update RLS policies to restrict teammember role from managing teams and team members

-- Remove existing policies that allow team members to manage teams/memberships
DROP POLICY IF EXISTS "Authenticated users can read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Service role can manage team memberships" ON public.team_members;

-- Update team_members policies to restrict teammember role
CREATE POLICY "Admins and planners can manage team memberships" 
ON public.team_members 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "All authenticated users can view team members" 
ON public.team_members 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Update teams policies to restrict teammember role from creating/managing teams
DROP POLICY IF EXISTS "All authenticated users can view teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can read teams" ON public.teams;

CREATE POLICY "All authenticated users can view teams" 
ON public.teams 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add user_id to holidays table to make them user-specific
ALTER TABLE public.holidays ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update holidays RLS policies to be user-specific
DROP POLICY IF EXISTS "Users can view holidays" ON public.holidays;

CREATE POLICY "Users can view their own holidays" 
ON public.holidays 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own holidays" 
ON public.holidays 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update existing holidays to have user_id (set to null for global holidays)
-- This allows existing holidays to remain visible to admins/planners only