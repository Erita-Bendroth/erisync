-- Create vacation_requests table
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_vacation_requests_user_id ON public.vacation_requests(user_id);
CREATE INDEX idx_vacation_requests_status ON public.vacation_requests(status);
CREATE INDEX idx_vacation_requests_team_id ON public.vacation_requests(team_id);

-- Enable RLS
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own vacation requests"
  ON public.vacation_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create vacation requests"
  ON public.vacation_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins and planners can view all requests
CREATE POLICY "Admins and planners can view all vacation requests"
  ON public.vacation_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  );

-- Managers can view requests from their team members
CREATE POLICY "Managers can view team vacation requests"
  ON public.vacation_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  );

-- Admins and planners can approve/reject requests
CREATE POLICY "Admins and planners can update vacation requests"
  ON public.vacation_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  );

-- Trigger to update updated_at
CREATE TRIGGER update_vacation_requests_updated_at
  BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get top-level planner/manager for a team
CREATE OR REPLACE FUNCTION public.get_top_level_approver_for_team(_team_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, first_name TEXT, last_name TEXT, team_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  top_team_id UUID;
BEGIN
  -- Find the top-level team in the hierarchy
  WITH RECURSIVE team_hierarchy AS (
    SELECT id, parent_team_id, name
    FROM public.teams
    WHERE id = _team_id
    
    UNION ALL
    
    SELECT t.id, t.parent_team_id, t.name
    FROM public.teams t
    INNER JOIN team_hierarchy th ON t.id = th.parent_team_id
  )
  SELECT th.id INTO top_team_id
  FROM team_hierarchy th
  WHERE th.parent_team_id IS NULL
  LIMIT 1;
  
  -- Get planners/managers from the top-level team
  -- Prioritize planners, then managers
  RETURN QUERY
  SELECT DISTINCT p.user_id, p.email, p.first_name, p.last_name, t.name
  FROM public.team_members tm
  INNER JOIN public.profiles p ON tm.user_id = p.user_id
  INNER JOIN public.user_roles ur ON tm.user_id = ur.user_id
  INNER JOIN public.teams t ON tm.team_id = t.id
  WHERE tm.team_id = top_team_id
    AND (ur.role = 'planner'::app_role OR (ur.role = 'manager'::app_role AND tm.is_manager = true))
  ORDER BY 
    CASE 
      WHEN ur.role = 'planner'::app_role THEN 1
      WHEN ur.role = 'manager'::app_role THEN 2
      ELSE 3
    END
  LIMIT 1;
END;
$$;

-- Function to check for overlapping vacation requests
CREATE OR REPLACE FUNCTION public.check_vacation_overlap(
  _user_id UUID,
  _requested_date DATE,
  _start_time TIME DEFAULT NULL,
  _end_time TIME DEFAULT NULL,
  _is_full_day BOOLEAN DEFAULT true,
  _exclude_request_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's an overlapping approved or pending request
  RETURN EXISTS (
    SELECT 1
    FROM public.vacation_requests
    WHERE user_id = _user_id
      AND requested_date = _requested_date
      AND status IN ('pending', 'approved')
      AND (_exclude_request_id IS NULL OR id != _exclude_request_id)
      AND (
        -- Both are full day
        (_is_full_day AND is_full_day)
        OR
        -- Check time overlap for partial days
        (NOT _is_full_day AND NOT is_full_day AND 
         (_start_time, _end_time) OVERLAPS (start_time, end_time))
      )
  );
END;
$$;