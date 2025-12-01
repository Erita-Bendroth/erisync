-- Drop and recreate get_partnership_team_members with location data
DROP FUNCTION IF EXISTS public.get_partnership_team_members(uuid);

CREATE OR REPLACE FUNCTION public.get_partnership_team_members(p_partnership_id uuid)
RETURNS TABLE(
  user_id uuid, 
  team_id uuid, 
  team_name text, 
  first_name text, 
  last_name text, 
  initials text,
  country_code text,
  region_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    tm.user_id,
    tm.team_id,
    t.name as team_name,
    p.first_name,
    p.last_name,
    p.initials,
    p.country_code,
    p.region_code
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  JOIN profiles p ON p.user_id = tm.user_id
  WHERE tm.team_id IN (
    SELECT unnest(team_ids)
    FROM team_planning_partners
    WHERE id = p_partnership_id
  )
  ORDER BY t.name, p.first_name, p.last_name;
END;
$function$;