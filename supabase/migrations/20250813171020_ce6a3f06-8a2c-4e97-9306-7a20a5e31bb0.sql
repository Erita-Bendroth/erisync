-- Re-enable RLS with proper policies that allow admin access

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing conflicting policies first
DROP POLICY IF EXISTS "Roles visibility policy" ON public.user_roles;
DROP POLICY IF EXISTS "Team membership visibility policy" ON public.team_members;

-- Create simple, working policies for user_roles
CREATE POLICY "User roles access policy" 
ON public.user_roles 
FOR SELECT 
USING (
  -- If user is not authenticated, allow (for server-side operations)
  auth.uid() IS NULL OR
  -- Admins can see all
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Planners can see all
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Users can see their own
  auth.uid() = user_id
);

-- Create simple, working policies for team_members
CREATE POLICY "Team members access policy" 
ON public.team_members 
FOR SELECT 
USING (
  -- If user is not authenticated, allow (for server-side operations)
  auth.uid() IS NULL OR
  -- Admins can see all
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Planners can see all
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Users can see their own memberships
  auth.uid() = user_id OR
  -- Users can see members of their teams
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);