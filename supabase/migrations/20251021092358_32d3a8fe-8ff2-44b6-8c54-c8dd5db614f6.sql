-- Function to mask an email address (shows first 2 chars + *** + domain)
CREATE OR REPLACE FUNCTION public.mask_email(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    CASE 
      WHEN email IS NULL THEN NULL
      WHEN position('@' in email) = 0 THEN email
      ELSE 
        substring(email from 1 for 2) || 
        repeat('*', greatest(0, position('@' in email) - 3)) || 
        substring(email from position('@' in email))
    END
$$;

-- Create a secure view that returns profiles with conditionally masked emails
-- Admins and planners see full emails, others see masked versions
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT
  p.id,
  p.user_id,
  p.first_name,
  p.last_name,
  p.initials,
  -- Conditionally mask email based on viewer's role
  CASE
    -- Show full email to admins and planners
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
    -- Show full email to the user themselves
    WHEN auth.uid() = p.user_id THEN p.email
    -- Mask email for everyone else (including managers viewing team members)
    ELSE mask_email(p.email)
  END as email,
  p.country_code,
  p.region_code,
  p.theme_preference,
  p.requires_password_change,
  p.created_at,
  p.updated_at
FROM public.profiles p;

-- Grant SELECT access to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Create RPC function to get team member profiles with masked emails
-- This provides a convenient way to fetch team members with automatic email masking
CREATE OR REPLACE FUNCTION public.get_team_members_safe(
  _team_id uuid
)
RETURNS TABLE (
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
SET search_path = public
AS $$
  SELECT
    tm.user_id,
    ps.first_name,
    ps.last_name,
    ps.initials,
    ps.email, -- Already masked by the view
    ps.country_code,
    ps.region_code
  FROM team_members tm
  JOIN profiles_safe ps ON ps.user_id = tm.user_id
  WHERE tm.team_id = _team_id
  ORDER BY ps.first_name, ps.last_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles with email masking for non-admin users. Admins and planners see full emails, managers and regular users see masked emails (e.g., er***@vestas.com).';
COMMENT ON FUNCTION public.get_team_members_safe IS 'Returns team members with automatically masked emails for non-admin viewers.';
COMMENT ON FUNCTION public.mask_email IS 'Masks email addresses by showing first 2 characters + *** + domain (e.g., jo***@example.com).';