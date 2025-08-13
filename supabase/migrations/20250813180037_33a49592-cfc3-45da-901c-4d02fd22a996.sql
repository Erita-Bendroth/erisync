-- Create simple, clear RLS policies for holidays table
CREATE POLICY "holidays_all_access"
ON public.holidays
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
);