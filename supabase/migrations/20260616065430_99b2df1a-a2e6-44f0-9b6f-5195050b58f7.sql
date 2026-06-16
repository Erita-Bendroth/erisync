CREATE TABLE public.partnership_shadow_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.team_planning_partners(id) ON DELETE CASCADE,
  lead_user_id uuid NOT NULL,
  shadow_user_id uuid NOT NULL,
  applies_to text[] NOT NULL DEFAULT ARRAY['E','L','N'],
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, lead_user_id, shadow_user_id),
  CHECK (lead_user_id <> shadow_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_shadow_pairs TO authenticated;
GRANT ALL ON public.partnership_shadow_pairs TO service_role;

ALTER TABLE public.partnership_shadow_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shadow_pairs_read"
ON public.partnership_shadow_pairs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_planning_partners tpp
    JOIN public.team_members tm ON tm.team_id = ANY(tpp.team_ids)
    WHERE tpp.id = partnership_id AND tm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
);

CREATE POLICY "shadow_pairs_write"
ON public.partnership_shadow_pairs
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.team_planning_partners tpp
    JOIN public.team_members tm ON tm.team_id = ANY(tpp.team_ids)
    WHERE tpp.id = partnership_id
      AND tm.user_id = auth.uid()
      AND tm.is_manager = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planner'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.team_planning_partners tpp
    JOIN public.team_members tm ON tm.team_id = ANY(tpp.team_ids)
    WHERE tpp.id = partnership_id
      AND tm.user_id = auth.uid()
      AND tm.is_manager = true
  )
);

CREATE TRIGGER update_partnership_shadow_pairs_updated_at
BEFORE UPDATE ON public.partnership_shadow_pairs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();