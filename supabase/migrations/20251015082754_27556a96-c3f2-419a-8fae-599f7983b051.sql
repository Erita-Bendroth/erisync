-- Update RLS policies to support delegation for schedule entries

-- Drop existing manager policies for schedule entries that don't support delegation
DROP POLICY IF EXISTS "Managers can delete entries for their team members" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers can insert entries for their team members" ON public.schedule_entries;
DROP POLICY IF EXISTS "Managers can update entries for their team members" ON public.schedule_entries;

-- Create new policies that support both direct manager access and delegation
CREATE POLICY "Managers and delegates can delete schedule entries for their teams"
ON public.schedule_entries
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND (
    auth.uid() = user_id OR
    has_manager_access(auth.uid(), team_id)
  ))
);

CREATE POLICY "Managers and delegates can insert schedule entries for their teams"
ON public.schedule_entries
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND (
    auth.uid() = user_id OR
    has_manager_access(auth.uid(), team_id)
  ))
);

CREATE POLICY "Managers and delegates can update schedule entries for their teams"
ON public.schedule_entries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND (
    auth.uid() = user_id OR
    has_manager_access(auth.uid(), team_id)
  ))
);

-- Update vacation_requests policies to support delegation
DROP POLICY IF EXISTS "Managers can view team vacation requests" ON public.vacation_requests;

CREATE POLICY "Managers and delegates can view vacation requests for their teams"
ON public.vacation_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'manager'::app_role) AND 
    has_manager_access(auth.uid(), team_id))
);

-- Create a function to automatically expire delegations
CREATE OR REPLACE FUNCTION public.check_and_expire_delegations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update expired delegations
  UPDATE public.manager_delegations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND end_date < now();
END;
$$;

-- Add comment for clarity
COMMENT ON FUNCTION public.check_and_expire_delegations() IS 'Automatically expires delegations that have passed their end_date';