-- Drop the profiles_safe view that was using SECURITY DEFINER
DROP VIEW IF EXISTS public.profiles_safe CASCADE;

-- Update get_team_members_safe to query profiles directly with the same email masking logic
CREATE OR REPLACE FUNCTION public.get_team_members_safe(_team_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text,
  email text,
  country_code text,
  region_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    tm.user_id,
    p.first_name,
    p.last_name,
    p.initials,
    CASE
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
      WHEN auth.uid() = p.user_id THEN p.email
      ELSE mask_email(p.email)
    END AS email,
    p.country_code,
    p.region_code
  FROM team_members tm
  JOIN profiles p ON p.user_id = tm.user_id
  WHERE tm.team_id = _team_id
  ORDER BY p.first_name, p.last_name;
$$;

COMMENT ON FUNCTION public.get_team_members_safe IS 'Returns team members with automatically masked emails for non-admin viewers. Admins and planners see full emails, users see their own email, others see masked emails.';