-- Create a security definer function to get eligible delegation users
-- This bypasses RLS to allow managers/planners to see eligible users for delegation

CREATE OR REPLACE FUNCTION public.get_eligible_delegation_users(_requesting_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _is_planner boolean;
  _is_manager boolean;
BEGIN
  -- Check requesting user's roles
  SELECT 
    bool_or(role = 'admin'),
    bool_or(role = 'planner'),
    bool_or(role = 'manager')
  INTO _is_admin, _is_planner, _is_manager
  FROM public.user_roles
  WHERE user_roles.user_id = _requesting_user_id;

  -- Admins can delegate to anyone with manager/planner/admin role
  IF _is_admin THEN
    RETURN QUERY
    SELECT DISTINCT
      p.user_id,
      p.first_name,
      p.last_name,
      p.email,
      array_agg(DISTINCT ur.role::text ORDER BY ur.role::text) as roles
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE ur.role IN ('admin', 'planner', 'manager')
      AND p.user_id != _requesting_user_id
    GROUP BY p.user_id, p.first_name, p.last_name, p.email
    ORDER BY p.first_name, p.last_name;
    RETURN;
  END IF;

  -- Planners can delegate to other planners and managers
  IF _is_planner THEN
    RETURN QUERY
    SELECT DISTINCT
      p.user_id,
      p.first_name,
      p.last_name,
      p.email,
      array_agg(DISTINCT ur.role::text ORDER BY ur.role::text) as roles
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE ur.role IN ('planner', 'manager')
      AND p.user_id != _requesting_user_id
    GROUP BY p.user_id, p.first_name, p.last_name, p.email
    ORDER BY p.first_name, p.last_name;
    RETURN;
  END IF;

  -- Managers can delegate to other managers and planners within their organization
  -- For now, allow them to see all managers and planners (can be restricted later)
  IF _is_manager THEN
    RETURN QUERY
    SELECT DISTINCT
      p.user_id,
      p.first_name,
      p.last_name,
      p.email,
      array_agg(DISTINCT ur.role::text ORDER BY ur.role::text) as roles
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE ur.role IN ('manager', 'planner')
      AND p.user_id != _requesting_user_id
    GROUP BY p.user_id, p.first_name, p.last_name, p.email
    ORDER BY p.first_name, p.last_name;
    RETURN;
  END IF;

  -- If user has no eligible role, return empty
  RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_eligible_delegation_users(uuid) TO authenticated;