-- Drop existing policies to fix conflicts and implement security fixes
DROP POLICY IF EXISTS "Users can view own roles and admins can view all" ON public.user_roles;

-- Create secure user_roles policy
CREATE POLICY "Secure user roles access" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role)
);

-- Drop and recreate team_members policy for better security
DROP POLICY IF EXISTS "Users can view team members of their own teams only" ON public.team_members;

CREATE POLICY "Secure team members access" 
ON public.team_members 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role)
);