
-- Offshore shift pattern support for partnerships
-- 1. partnership_shift_codes: configurable shift codes per partnership with recovery rules
CREATE TABLE public.partnership_shift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.team_planning_partners(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  is_working boolean NOT NULL DEFAULT true,
  shift_type text,
  recovery_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnership_shift_codes TO authenticated;
GRANT ALL ON public.partnership_shift_codes TO service_role;

ALTER TABLE public.partnership_shift_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view partnership shift codes"
  ON public.partnership_shift_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers/Admins can manage partnership shift codes"
  ON public.partnership_shift_codes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planner')
    OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planner')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER update_partnership_shift_codes_updated_at
  BEFORE UPDATE ON public.partnership_shift_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. partnership_rotation_rosters: add offshore mode flag + cycle length
ALTER TABLE public.partnership_rotation_rosters
  ADD COLUMN IF NOT EXISTS offshore_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_length_days integer;

-- 3. roster_day_assignments: day-grained assignments for offshore rosters
CREATE TABLE public.roster_day_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id uuid NOT NULL REFERENCES public.partnership_rotation_rosters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  shift_code_id uuid REFERENCES public.partnership_shift_codes(id) ON DELETE SET NULL,
  is_recovery boolean NOT NULL DEFAULT false,
  is_anchor boolean NOT NULL DEFAULT false,
  generated_by text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roster_id, user_id, work_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_day_assignments TO authenticated;
GRANT ALL ON public.roster_day_assignments TO service_role;

ALTER TABLE public.roster_day_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view roster day assignments"
  ON public.roster_day_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers/Admins can manage roster day assignments"
  ON public.roster_day_assignments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planner')
    OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planner')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER update_roster_day_assignments_updated_at
  BEFORE UPDATE ON public.roster_day_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_roster_day_assignments_roster ON public.roster_day_assignments(roster_id);
CREATE INDEX idx_roster_day_assignments_user_date ON public.roster_day_assignments(user_id, work_date);
