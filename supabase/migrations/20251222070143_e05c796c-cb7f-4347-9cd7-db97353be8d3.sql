-- Fix get_multiple_basic_profile_info to properly lookup profiles by user_id column
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
      ELSE p.first_name
    END
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