-- Add selected_planner_id to vacation_requests table
ALTER TABLE public.vacation_requests 
ADD COLUMN IF NOT EXISTS selected_planner_id uuid REFERENCES auth.users(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_vacation_requests_selected_planner 
ON public.vacation_requests(selected_planner_id);

-- Create function to get planners accessible to a user's team
CREATE OR REPLACE FUNCTION public.get_planners_for_user_team(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Get planners who have access to the user's teams
  RETURN QUERY
  SELECT DISTINCT
    p.user_id,
    p.first_name,
    p.last_name,
    p.email
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.role = 'planner'
    AND p.email IS NOT NULL
  ORDER BY p.first_name, p.last_name;
END;
$$;

-- Comment for documentation
COMMENT ON FUNCTION public.get_planners_for_user_team IS 
'Returns list of planners who can approve vacation requests. Currently returns all planners as they have organization-wide access.';