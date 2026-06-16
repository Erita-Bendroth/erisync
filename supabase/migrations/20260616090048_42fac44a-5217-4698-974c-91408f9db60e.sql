
CREATE TABLE public.open_shift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  shift_type text NOT NULL,
  required int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open',
  claimed_by uuid,
  claimed_at timestamptz,
  created_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT open_shift_requests_status_check CHECK (status IN ('open','claimed','cancelled'))
);

CREATE UNIQUE INDEX open_shift_requests_unique_open
  ON public.open_shift_requests (team_id, shift_date, shift_type)
  WHERE status = 'open';

CREATE INDEX open_shift_requests_team_status_idx
  ON public.open_shift_requests (team_id, status);

GRANT SELECT, INSERT, UPDATE ON public.open_shift_requests TO authenticated;
GRANT ALL ON public.open_shift_requests TO service_role;

ALTER TABLE public.open_shift_requests ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the team or admin/planner
CREATE POLICY "Team members can view open shift requests"
  ON public.open_shift_requests FOR SELECT
  TO authenticated
  USING (
    public.is_in_same_team(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
  );

-- Insert: only managers of the team or admin/planner
CREATE POLICY "Managers can create open shift requests"
  ON public.open_shift_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_manager_edit_access(auth.uid(), team_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'planner'::app_role)
    )
  );

-- Update: managers can cancel/edit; team members can claim an open request for themselves
CREATE POLICY "Managers and claimers can update open shift requests"
  ON public.open_shift_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_manager_edit_access(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
    OR public.is_in_same_team(auth.uid(), team_id)
  )
  WITH CHECK (
    public.has_manager_edit_access(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
    OR (claimed_by = auth.uid() AND status = 'claimed')
  );

CREATE TRIGGER open_shift_requests_set_updated_at
BEFORE UPDATE ON public.open_shift_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On claim: auto-create/update schedule_entries for the claimer
CREATE OR REPLACE FUNCTION public.apply_open_shift_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'claimed'
     AND (OLD.status IS DISTINCT FROM 'claimed')
     AND NEW.claimed_by IS NOT NULL THEN

    IF NEW.claimed_at IS NULL THEN
      NEW.claimed_at := now();
    END IF;

    INSERT INTO public.schedule_entries (
      user_id, team_id, date, availability_status, activity_type, shift_type, notes, created_by
    ) VALUES (
      NEW.claimed_by, NEW.team_id, NEW.shift_date, 'available', 'work', NEW.shift_type,
      '[coverage-claim] open_shift_request:' || NEW.id::text, NEW.claimed_by
    )
    ON CONFLICT (user_id, date, team_id) DO UPDATE
      SET availability_status = 'available',
          activity_type = 'work',
          shift_type = EXCLUDED.shift_type,
          notes = EXCLUDED.notes,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER open_shift_requests_apply_claim
BEFORE UPDATE ON public.open_shift_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_open_shift_claim();

ALTER PUBLICATION supabase_realtime ADD TABLE public.open_shift_requests;
