-- Re-enable RLS and create working policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policies that allow all authenticated users to view data
CREATE POLICY "Allow authenticated read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Keep existing admin/planner management policies for other operations
CREATE POLICY "Allow planners to manage" ON public.teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'planner'::app_role));
CREATE POLICY "Allow admins to manage" ON public.teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));