CREATE OR REPLACE FUNCTION public.get_substitute_candidates(_absent_user_id uuid)
RETURNS TABLE(user_id uuid, first_name text, last_name text, initials text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (p.user_id)
    p.user_id,
    p.first_name,
    p.last_name,
    COALESCE(
      NULLIF(p.initials, ''),
      CASE
        WHEN p.last_name IS NOT NULL AND p.last_name <> ''
        THEN LEFT(p.first_name, 1) || LEFT(p.last_name, 1)
        ELSE NULLIF(p.first_name, '')
      END,
      '??'
    ) AS initials
  FROM public.team_members tm_absent
  JOIN public.team_members tm_other ON tm_other.team_id = tm_absent.team_id
  JOIN public.profiles p ON p.user_id = tm_other.user_id
  WHERE tm_absent.user_id = _absent_user_id
    AND tm_other.user_id <> _absent_user_id
    AND auth.uid() IS NOT NULL
  ORDER BY p.user_id, p.first_name, p.last_name;
$function$;

REVOKE ALL ON FUNCTION public.get_substitute_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_substitute_candidates(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_substitute_candidates IS 'Returns distinct candidates for substitute assignment: union of members across every team the absent user belongs to.';