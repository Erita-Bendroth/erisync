
ALTER TABLE public.open_shift_requests
  ADD COLUMN partnership_id uuid;

CREATE INDEX open_shift_requests_partnership_idx
  ON public.open_shift_requests (partnership_id) WHERE partnership_id IS NOT NULL;

-- Replace claim trigger so the schedule entry is filed under the claimer's
-- own team (within the partnership) when partnership_id is set.
CREATE OR REPLACE FUNCTION public.apply_open_shift_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_team uuid;
  v_partnership_teams uuid[];
BEGIN
  IF NEW.status = 'claimed'
     AND (OLD.status IS DISTINCT FROM 'claimed')
     AND NEW.claimed_by IS NOT NULL THEN

    IF NEW.claimed_at IS NULL THEN
      NEW.claimed_at := now();
    END IF;

    v_target_team := NEW.team_id;

    IF NEW.partnership_id IS NOT NULL THEN
      SELECT team_ids INTO v_partnership_teams
      FROM public.team_planning_partners
      WHERE id = NEW.partnership_id;

      IF v_partnership_teams IS NOT NULL THEN
        SELECT tm.team_id INTO v_target_team
        FROM public.team_members tm
        WHERE tm.user_id = NEW.claimed_by
          AND tm.team_id = ANY(v_partnership_teams)
        LIMIT 1;
        IF v_target_team IS NULL THEN
          v_target_team := NEW.team_id;
        END IF;
      END IF;
    END IF;

    INSERT INTO public.schedule_entries (
      user_id, team_id, date, availability_status, activity_type, shift_type, notes, created_by
    ) VALUES (
      NEW.claimed_by, v_target_team, NEW.shift_date, 'available', 'work', NEW.shift_type,
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
