-- Fix critical security issue: Restrict manager access to email addresses
-- Managers should only see email addresses of their direct team members

-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Managers can view basic profile info with restrictions" ON public.profiles;

-- Create a more restrictive policy for full profile access (including emails)
CREATE POLICY "Users can view full profiles with team restrictions" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id OR
  -- Admins and planners can see all profiles
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Managers can only see full profiles (including emails) of their direct team members
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid() 
    AND tm1.is_manager = true
    AND tm2.user_id = profiles.user_id
  ))
);

-- Create a function to get basic profile info (names, initials) for schedule display
-- This allows managers to see names for scheduling without exposing emails
CREATE OR REPLACE FUNCTION public.get_basic_profile_info(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    (LEFT(p.first_name, 1) || LEFT(p.last_name, 1)) as initials
  FROM public.profiles p
  WHERE p.user_id = _user_id
  AND (
    -- Users can see their own basic info
    auth.uid() = p.user_id OR
    -- Admins, planners, and managers can see basic info for scheduling
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

-- Create a function to get multiple basic profile infos for efficiency
CREATE OR REPLACE FUNCTION public.get_multiple_basic_profile_info(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  initials text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    (LEFT(p.first_name, 1) || LEFT(p.last_name, 1)) as initials
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
  AND (
    -- Users can see their own basic info
    auth.uid() = p.user_id OR
    -- Admins, planners, and managers can see basic info for scheduling
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