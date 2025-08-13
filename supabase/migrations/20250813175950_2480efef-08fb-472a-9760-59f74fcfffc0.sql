-- Clean up conflicting RLS policies for holidays table
-- Drop the conflicting policies and create cleaner ones

DROP POLICY IF EXISTS "Planners can manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "Users can manage their own holidays" ON public.holidays;
DROP POLICY IF EXISTS "Planners and admins can insert holidays for any user" ON public.holidays;
DROP POLICY IF EXISTS "Planners and admins can update holidays for any user" ON public.holidays;

-- Create clear, non-conflicting policies
CREATE POLICY "holidays_select_policy"
ON public.holidays
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
);

CREATE POLICY "holidays_insert_policy"
ON public.holidays
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
);

CREATE POLICY "holidays_update_policy"
ON public.holidays
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
);

CREATE POLICY "holidays_delete_policy"
ON public.holidays
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR 
  auth.uid() = user_id
);