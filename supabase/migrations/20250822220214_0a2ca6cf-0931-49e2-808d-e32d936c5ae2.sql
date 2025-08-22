-- Fix: Allow managers to see basic profile info (names, initials) of ALL users
-- Only restrict email access to direct team members

-- Update the basic profile functions to allow managers broader access for scheduling
DROP FUNCTION IF EXISTS public.get_basic_profile_info(_user_id uuid);
DROP FUNCTION IF EXISTS public.get_multiple_basic_profile_info(_user_ids uuid[]);

-- Create function that allows managers to see names/initials of all users (for scheduling)
-- But email addresses only for their direct team members
CREATE OR REPLACE FUNCTION public.get_basic_profile_info(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text,
  email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    (LEFT(p.first_name, 1) || LEFT(p.last_name, 1)) as initials,
    CASE 
      -- Users can see their own email
      WHEN auth.uid() = p.user_id THEN p.email
      -- Admins and planners can see all emails
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
      -- Managers can see emails only of their direct team members
      WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
        SELECT 1 FROM team_members tm1
        INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = auth.uid() 
        AND tm1.is_manager = true
        AND tm2.user_id = p.user_id
      ) THEN p.email
      -- Otherwise, hide email for security
      ELSE null
    END as email
  FROM public.profiles p
  WHERE p.user_id = _user_id
  AND (
    -- Users can see their own info
    auth.uid() = p.user_id OR
    -- Admins, planners, and managers can see basic info of all users for scheduling
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    -- Team members can see basic info of their teammates
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = p.user_id
    ))
  );
$$;

-- Create function for multiple users with same logic
CREATE OR REPLACE FUNCTION public.get_multiple_basic_profile_info(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text,
  email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    (LEFT(p.first_name, 1) || LEFT(p.last_name, 1)) as initials,
    CASE 
      -- Users can see their own email
      WHEN auth.uid() = p.user_id THEN p.email
      -- Admins and planners can see all emails
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
      -- Managers can see emails only of their direct team members
      WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
        SELECT 1 FROM team_members tm1
        INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = auth.uid() 
        AND tm1.is_manager = true
        AND tm2.user_id = p.user_id
      ) THEN p.email
      -- Otherwise, hide email for security
      ELSE null
    END as email
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
  AND (
    -- Users can see their own info
    auth.uid() = p.user_id OR
    -- Admins, planners, and managers can see basic info of all users for scheduling
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    -- Team members can see basic info of their teammates
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = p.user_id
    ))
  );
$$;

-- Also create a simpler function that gets all basic profile info for managers/planners
CREATE OR REPLACE FUNCTION public.get_all_basic_profiles()
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text,
  email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    (LEFT(p.first_name, 1) || LEFT(p.last_name, 1)) as initials,
    CASE 
      -- Admins and planners can see all emails
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
      -- Managers can see emails only of their direct team members
      WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
        SELECT 1 FROM team_members tm1
        INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = auth.uid() 
        AND tm1.is_manager = true
        AND tm2.user_id = p.user_id
      ) THEN p.email
      -- Otherwise, hide email for security
      ELSE null
    END as email
  FROM public.profiles p
  WHERE (
    -- Admins, planners, and managers can see basic info of all users
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
  ORDER BY p.first_name, p.last_name;
$$;