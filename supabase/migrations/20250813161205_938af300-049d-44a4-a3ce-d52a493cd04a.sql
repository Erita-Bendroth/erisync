-- SECURITY FIX: Remove overly permissive profile access policy and replace with secure alternatives
-- This fixes the security vulnerability where any authenticated user could access all employee personal information

-- 1. Drop the dangerous policy that allows all authenticated users to read all profiles
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

-- 2. Create secure, role-based policies following principle of least privilege

-- Policy 1: Users can view their own profile only
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Planners can view all profiles (needed for schedule management)
CREATE POLICY "Planners can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'planner'::app_role));

-- Policy 3: Managers can view profiles of their team members
CREATE POLICY "Managers can view team member profiles" 
ON public.profiles 
FOR SELECT 
USING (
    has_role(auth.uid(), 'manager'::app_role) AND 
    user_id IN (
        SELECT tm.user_id 
        FROM public.team_members tm 
        WHERE tm.team_id IN (
            SELECT team_id 
            FROM public.team_members 
            WHERE user_id = auth.uid() AND is_manager = true
        )
    )
);

-- Note: Admin policies already exist and remain unchanged