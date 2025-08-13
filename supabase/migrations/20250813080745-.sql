-- Fix the user_roles RLS policies to allow initial admin setup
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Only planners can manage roles" ON public.user_roles;

-- Create new policies that allow initial setup
-- Allow users to insert roles if no planners exist yet, or if they are planners
CREATE POLICY "Allow initial admin setup and planner management" ON public.user_roles
    FOR INSERT 
    WITH CHECK (
        -- Allow if no planners exist yet (bootstrap case)
        NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'planner')
        OR 
        -- Or if the current user is a planner
        public.has_role(auth.uid(), 'planner')
    );

-- Allow planners to update and delete roles
CREATE POLICY "Planners can update roles" ON public.user_roles
    FOR UPDATE 
    USING (public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Planners can delete roles" ON public.user_roles
    FOR DELETE 
    USING (public.has_role(auth.uid(), 'planner'));