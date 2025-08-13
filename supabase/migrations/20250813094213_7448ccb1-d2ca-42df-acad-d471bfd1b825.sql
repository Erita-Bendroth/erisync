-- Drop all existing policies and recreate them properly
DROP POLICY IF EXISTS "Allow authenticated read" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.teams;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.team_members;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.user_roles;
DROP POLICY IF EXISTS "All authenticated users can view team memberships" ON public.team_members;
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;

-- Create simple read policies for all authenticated users
CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read team_members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);