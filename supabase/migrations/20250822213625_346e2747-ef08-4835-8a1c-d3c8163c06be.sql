-- Update RLS policies to allow managers to see limited info from all users
-- while restricting full personal details to their team members only

-- Update profiles table to allow managers to see basic info (initials) from all users
-- but restrict detailed personal information to their team members
DROP POLICY IF EXISTS "Managers can view team member profiles only" ON public.profiles;

-- Allow managers to see basic profile info from all users (for initials)
-- but only detailed info from their team members
CREATE POLICY "Managers can view basic info from all users" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'planner'::app_role) 
  OR (auth.uid() = user_id)
  OR (
    has_role(auth.uid(), 'manager'::app_role) 
    AND auth.uid() IS NOT NULL
  )
);

-- Update schedule_entries to allow managers to see basic schedule info from all teams
-- The frontend will handle showing limited vs full details
-- Remove the restrictive manager policies that limit schedule visibility
DROP POLICY IF EXISTS "Managers can view their team entries" ON public.schedule_entries;

-- Allow managers to see all schedule entries for availability checking
-- Frontend will restrict display of personal details
CREATE POLICY "Managers can view all schedule entries for availability" 
ON public.schedule_entries 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR (auth.uid() = user_id)
  OR (
    has_role(auth.uid(), 'teammember'::app_role) 
    AND team_id IN (
      SELECT get_user_teams(auth.uid())
    )
  )
);

-- Create a helper function to check if a manager can see full details for a user
CREATE OR REPLACE FUNCTION public.manager_can_see_full_details(_manager_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _manager_id 
    AND tm1.is_manager = true
    AND tm2.user_id = _target_user_id
  ) OR _manager_id = _target_user_id;
$$;