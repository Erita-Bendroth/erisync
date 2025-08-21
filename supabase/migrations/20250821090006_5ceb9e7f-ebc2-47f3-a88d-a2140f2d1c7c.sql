-- Create a function to expose availability (work = available) for managers/planners/admins across all teams
CREATE OR REPLACE FUNCTION public.get_schedule_availability(_start date, _end date)
RETURNS TABLE(user_id uuid, team_id uuid, date date, availability_status availability_status)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT se.user_id, se.team_id, se.date,
    CASE WHEN se.activity_type = 'work' THEN 'available'::availability_status
         ELSE 'unavailable'::availability_status
    END AS availability_status
  FROM public.schedule_entries se
  WHERE se.date >= _start AND se.date <= _end
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'planner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_schedule_availability(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_schedule_availability(date, date) TO authenticated;