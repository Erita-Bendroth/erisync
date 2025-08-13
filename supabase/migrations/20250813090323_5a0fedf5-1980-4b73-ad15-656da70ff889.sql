-- Add a policy to allow service role to bypass RLS for team_members operations
-- This will allow the bulk import function to work properly

CREATE POLICY "Service role can manage team memberships" 
ON public.team_members 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);