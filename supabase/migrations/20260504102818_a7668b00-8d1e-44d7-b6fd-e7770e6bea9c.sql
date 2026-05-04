-- =====================================================================
-- Substitute Assignments
-- Manager-driven coverage for any absence type, independent of vacations.
-- Reason + notes are private to managers/admins/planners.
-- =====================================================================

CREATE TABLE public.substitute_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                date NOT NULL,
  team_id             uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  absent_user_id      uuid NOT NULL,
  substitute_user_id  uuid NOT NULL,
  reason              text,
  notes               text,
  absence_entry_id    uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  created_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT substitute_assignments_unique_per_day
    UNIQUE (date, team_id, absent_user_id),
  CONSTRAINT substitute_assignments_distinct_users
    CHECK (absent_user_id <> substitute_user_id)
);

CREATE INDEX idx_subassign_team_date           ON public.substitute_assignments (team_id, date);
CREATE INDEX idx_subassign_absent_user_date    ON public.substitute_assignments (absent_user_id, date);
CREATE INDEX idx_subassign_substitute_user_date ON public.substitute_assignments (substitute_user_id, date);
CREATE INDEX idx_subassign_absence_entry       ON public.substitute_assignments (absence_entry_id);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_substitute_assignments_updated_at
BEFORE UPDATE ON public.substitute_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- Sync trigger: keep absence_entry_id linked to the matching
-- schedule_entries row whenever (user_id, team_id, date) changes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_substitute_absence_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  SELECT id INTO v_entry_id
  FROM public.schedule_entries
  WHERE user_id = NEW.absent_user_id
    AND team_id = NEW.team_id
    AND date    = NEW.date
  LIMIT 1;

  NEW.absence_entry_id := v_entry_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_substitute_assignments_sync_entry
BEFORE INSERT OR UPDATE OF date, team_id, absent_user_id
ON public.substitute_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_substitute_absence_entry();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.substitute_assignments ENABLE ROW LEVEL SECURITY;

-- Managers / admins / planners: full access for accessible teams
CREATE POLICY "Managers can manage substitutes for their teams"
ON public.substitute_assignments
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

-- NOTE: We deliberately do NOT add a SELECT policy for plain team members
-- on the base table, because that table contains private columns (reason,
-- notes). Non-managers must read from substitute_assignments_public.

-- ---------------------------------------------------------------------
-- Public view (no reason, no notes) for team members
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.substitute_assignments_public
WITH (security_invoker = on)
AS
SELECT
  sa.id,
  sa.date,
  sa.team_id,
  sa.absent_user_id,
  sa.substitute_user_id,
  sa.absence_entry_id,
  sa.created_at,
  sa.updated_at
FROM public.substitute_assignments sa
WHERE
  -- Same access as the base table (managers/admins/planners) ...
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planner'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND sa.team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
  -- ... PLUS team members of the same team as the assignment, including
  -- the substitute and absent person themselves.
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.team_id = sa.team_id
  );

GRANT SELECT ON public.substitute_assignments_public TO authenticated;