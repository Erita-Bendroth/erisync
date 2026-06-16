
-- Helper: is _target a teammate of _viewer through any planning partnership?
CREATE OR REPLACE FUNCTION public.is_partnership_teammate(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_planning_partners tpp
    WHERE EXISTS (
      SELECT 1 FROM public.team_members tmv
      WHERE tmv.user_id = _viewer
        AND tmv.team_id = ANY(tpp.team_ids)
    )
    AND EXISTS (
      SELECT 1 FROM public.team_members tmt
      WHERE tmt.user_id = _target
        AND tmt.team_id = ANY(tpp.team_ids)
    )
  );
$$;

-- Allow viewers to read schedule entries of any partnership teammate
DROP POLICY IF EXISTS "Partnership teammates view each other's schedules" ON public.schedule_entries;
CREATE POLICY "Partnership teammates view each other's schedules"
ON public.schedule_entries
FOR SELECT
TO authenticated
USING (public.is_partnership_teammate(auth.uid(), user_id));

-- Allow team members to read rosters of partnerships they belong to
DROP POLICY IF EXISTS "Team members view rosters for their partnerships" ON public.partnership_rotation_rosters;
CREATE POLICY "Team members view rosters for their partnerships"
ON public.partnership_rotation_rosters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_planning_partners tpp
    WHERE tpp.id = partnership_rotation_rosters.partnership_id
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.team_id = ANY(tpp.team_ids)
      )
  )
);
