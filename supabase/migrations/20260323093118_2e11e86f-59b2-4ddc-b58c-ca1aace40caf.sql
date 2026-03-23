
-- 1. Backfill profiles.initials from auth.users metadata where profiles data is missing
UPDATE public.profiles p
SET 
  initials = COALESCE(
    NULLIF(p.initials, ''),
    (SELECT u.raw_user_meta_data->>'initials' FROM auth.users u WHERE u.id = p.user_id),
    NULLIF(p.first_name, ''),
    'N/A'
  ),
  first_name = CASE 
    WHEN p.first_name IS NULL OR p.first_name = '' THEN 
      COALESCE(
        (SELECT u.raw_user_meta_data->>'initials' FROM auth.users u WHERE u.id = p.user_id),
        'N/A'
      )
    ELSE p.first_name
  END
WHERE (p.initials IS NULL OR p.initials = '')
   OR (p.first_name IS NULL OR p.first_name = '');

-- 2. Normalize get_team_members_safe to use consistent initials fallback
CREATE OR REPLACE FUNCTION public.get_team_members_safe(_team_id uuid)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, initials text, email text, country_code text, region_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    tm.user_id,
    p.first_name,
    p.last_name,
    COALESCE(
      NULLIF(p.initials, ''),
      CASE 
        WHEN p.last_name IS NOT NULL AND p.last_name != '' 
        THEN LEFT(p.first_name, 1) || LEFT(p.last_name, 1)
        ELSE NULLIF(p.first_name, '')
      END,
      '??'
    ) AS initials,
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
$function$;

-- 3. Normalize get_basic_profile_info to use consistent initials fallback
CREATE OR REPLACE FUNCTION public.get_basic_profile_info(_user_id uuid)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, initials text, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    COALESCE(
      NULLIF(p.initials, ''),
      CASE 
        WHEN p.last_name IS NOT NULL AND p.last_name != '' 
        THEN LEFT(p.first_name, 1) || LEFT(p.last_name, 1)
        ELSE NULLIF(p.first_name, '')
      END,
      '??'
    ) AS initials,
    CASE 
      WHEN auth.uid() = p.user_id THEN p.email
      WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
      WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
        SELECT 1 FROM team_members tm1
        INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = auth.uid() 
        AND tm1.is_manager = true
        AND tm2.user_id = p.user_id
      ) THEN p.email
      ELSE null
    END as email
  FROM public.profiles p
  WHERE p.user_id = _user_id
  AND (
    auth.uid() = p.user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = p.user_id
    ))
  );
$function$;

-- 4. Normalize get_all_basic_profiles
CREATE OR REPLACE FUNCTION public.get_all_basic_profiles()
 RETURNS TABLE(user_id uuid, first_name text, last_name text, initials text, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  COALESCE(
    NULLIF(p.initials, ''),
    CASE 
      WHEN p.last_name IS NOT NULL AND p.last_name != '' 
      THEN LEFT(p.first_name, 1) || LEFT(p.last_name, 1)
      ELSE NULLIF(p.first_name, '')
    END,
    '??'
  ) AS initials,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
    WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = p.user_id
    ) THEN p.email
    ELSE null
  END as email
FROM public.profiles p
WHERE (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
)
ORDER BY p.first_name, p.last_name;
$function$;

-- 5. Also normalize get_multiple_basic_profile_info
CREATE OR REPLACE FUNCTION public.get_multiple_basic_profile_info(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, first_name text, last_name text, initials text, email text, country_code text, region_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  COALESCE(
    NULLIF(p.initials, ''),
    CASE 
      WHEN p.last_name IS NOT NULL AND p.last_name != '' 
      THEN LEFT(p.first_name, 1) || LEFT(p.last_name, 1)
      ELSE NULLIF(p.first_name, '')
    END,
    '??'
  ) AS initials,
  CASE 
    WHEN auth.uid() = p.user_id THEN p.email
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role) THEN p.email
    WHEN has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = p.user_id
    ) THEN p.email
    ELSE null
  END as email,
  p.country_code,
  p.region_code
FROM public.profiles p
WHERE p.user_id = ANY(_user_ids)
AND (
  auth.uid() = p.user_id OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
    AND tm2.user_id = p.user_id
  ))
);
$function$;
