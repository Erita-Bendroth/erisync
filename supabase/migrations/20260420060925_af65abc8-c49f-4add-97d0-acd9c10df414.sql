-- =========================================================
-- Roster Workflow State Machine Migration
-- =========================================================

-- 1. Add version counter to rosters
ALTER TABLE public.partnership_rotation_rosters
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 2. Add state + version snapshot to per-team approvals
ALTER TABLE public.roster_manager_approvals
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS roster_version integer NOT NULL DEFAULT 1;

UPDATE public.roster_manager_approvals
SET state = CASE WHEN approved = true THEN 'approved' ELSE 'pending' END
WHERE state = 'pending' AND approved = true;

ALTER TABLE public.roster_manager_approvals
  DROP CONSTRAINT IF EXISTS roster_manager_approvals_state_check;
ALTER TABLE public.roster_manager_approvals
  ADD CONSTRAINT roster_manager_approvals_state_check
  CHECK (state IN ('pending', 'approved', 'rejected'));

-- 3. Drop old status constraint FIRST so we can migrate values, then add new one
ALTER TABLE public.partnership_rotation_rosters
  DROP CONSTRAINT IF EXISTS partnership_rotation_rosters_status_check;

UPDATE public.partnership_rotation_rosters
SET status = CASE
  WHEN status = 'pending_approval' THEN 'submitted'
  WHEN status = 'approved' THEN 'fully_approved'
  WHEN status = 'implemented' THEN 'activated'
  ELSE status
END
WHERE status IN ('pending_approval', 'approved', 'implemented');

ALTER TABLE public.partnership_rotation_rosters
  ADD CONSTRAINT partnership_rotation_rosters_status_check
  CHECK (status IN ('draft','submitted','partially_approved','fully_approved','needs_changes','activated'));

-- =========================================================
-- 4. Trigger: bump version + reset approvals when assignments change
-- =========================================================
CREATE OR REPLACE FUNCTION public.bump_roster_version_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_roster_id uuid;
  v_current_status text;
  v_actor uuid := auth.uid();
BEGIN
  v_roster_id := COALESCE(NEW.roster_id, OLD.roster_id);

  SELECT status INTO v_current_status
  FROM public.partnership_rotation_rosters
  WHERE id = v_roster_id;

  IF v_current_status = 'activated' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_current_status IN ('submitted','partially_approved','fully_approved','needs_changes') THEN
    UPDATE public.partnership_rotation_rosters
    SET version = version + 1,
        status = 'draft',
        updated_at = now()
    WHERE id = v_roster_id;

    UPDATE public.roster_manager_approvals
    SET state = 'pending',
        approved = false,
        approved_at = NULL,
        updated_at = now()
    WHERE roster_id = v_roster_id;

    INSERT INTO public.roster_activity_log (roster_id, user_id, action, details)
    VALUES (
      v_roster_id,
      COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid),
      'roster_changed_after_approval',
      jsonb_build_object('trigger_op', TG_OP)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_roster_version ON public.roster_week_assignments;
CREATE TRIGGER trg_bump_roster_version
AFTER INSERT OR UPDATE OR DELETE ON public.roster_week_assignments
FOR EACH ROW EXECUTE FUNCTION public.bump_roster_version_on_change();

-- =========================================================
-- 5. Trigger: enforce approval guards
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_approval_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_partnership_id uuid;
  v_team_in_partnership boolean;
  v_actor uuid := auth.uid();
  v_is_admin_planner boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, partnership_id INTO v_status, v_partnership_id
  FROM public.partnership_rotation_rosters
  WHERE id = NEW.roster_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Roster not found';
  END IF;

  IF NEW.state IN ('approved','rejected')
     AND v_status NOT IN ('submitted','partially_approved','needs_changes') THEN
    RAISE EXCEPTION 'Cannot approve/reject roster in status %', v_status;
  END IF;

  v_is_admin_planner := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor AND role IN ('admin','planner')
  );

  IF NEW.manager_id <> v_actor AND NOT v_is_admin_planner THEN
    RAISE EXCEPTION 'Cannot record approval for another manager';
  END IF;

  SELECT (NEW.team_id = ANY(team_ids)) INTO v_team_in_partnership
  FROM public.team_planning_partners
  WHERE id = v_partnership_id;

  IF NOT COALESCE(v_team_in_partnership, false) THEN
    RAISE EXCEPTION 'Team % is not part of partnership %', NEW.team_id, v_partnership_id;
  END IF;

  NEW.approved := (NEW.state = 'approved');
  IF NEW.state = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  ELSIF NEW.state <> 'approved' THEN
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_approval_guards ON public.roster_manager_approvals;
CREATE TRIGGER trg_enforce_approval_guards
BEFORE INSERT OR UPDATE ON public.roster_manager_approvals
FOR EACH ROW EXECUTE FUNCTION public.enforce_approval_guards();

-- =========================================================
-- 6. Trigger: recompute roster status after approval change
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_roster_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_roster_id uuid;
  v_total int;
  v_approved int;
  v_rejected int;
  v_current_status text;
  v_new_status text;
  v_actor uuid := auth.uid();
BEGIN
  v_roster_id := COALESCE(NEW.roster_id, OLD.roster_id);

  SELECT status INTO v_current_status
  FROM public.partnership_rotation_rosters
  WHERE id = v_roster_id;

  IF v_current_status = 'activated' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE state = 'approved'),
    COUNT(*) FILTER (WHERE state = 'rejected')
  INTO v_total, v_approved, v_rejected
  FROM public.roster_manager_approvals
  WHERE roster_id = v_roster_id;

  IF v_total = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_rejected > 0 THEN
    v_new_status := 'needs_changes';
  ELSIF v_approved = v_total THEN
    v_new_status := 'fully_approved';
  ELSIF v_approved > 0 THEN
    v_new_status := 'partially_approved';
  ELSE
    v_new_status := COALESCE(v_current_status, 'submitted');
    IF v_new_status NOT IN ('submitted','needs_changes') THEN
      v_new_status := 'submitted';
    END IF;
  END IF;

  IF v_new_status <> v_current_status THEN
    UPDATE public.partnership_rotation_rosters
    SET status = v_new_status, updated_at = now()
    WHERE id = v_roster_id;

    INSERT INTO public.roster_activity_log (roster_id, user_id, action, details)
    VALUES (
      v_roster_id,
      COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid),
      CASE
        WHEN v_new_status = 'fully_approved' THEN 'fully_approved'
        WHEN v_new_status = 'needs_changes' THEN 'needs_changes_set'
        WHEN v_new_status = 'partially_approved' THEN 'partially_approved'
        ELSE 'status_changed'
      END,
      jsonb_build_object('from', v_current_status, 'to', v_new_status, 'approved', v_approved, 'rejected', v_rejected, 'total', v_total)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_roster_status ON public.roster_manager_approvals;
CREATE TRIGGER trg_recompute_roster_status
AFTER INSERT OR UPDATE OR DELETE ON public.roster_manager_approvals
FOR EACH ROW EXECUTE FUNCTION public.recompute_roster_status();

-- =========================================================
-- 7. RPC: activate_roster
-- =========================================================
CREATE OR REPLACE FUNCTION public.activate_roster(_roster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_version int;
  v_total int;
  v_approved_current int;
  v_actor uuid := auth.uid();
  v_is_admin_planner boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT status, version INTO v_status, v_version
  FROM public.partnership_rotation_rosters
  WHERE id = _roster_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Roster not found';
  END IF;

  v_is_admin_planner := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor AND role IN ('admin','planner')
  );

  IF v_status <> 'fully_approved' AND NOT v_is_admin_planner THEN
    RAISE EXCEPTION 'Roster must be fully_approved to activate (current: %)', v_status;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE state = 'approved' AND roster_version = v_version)
  INTO v_total, v_approved_current
  FROM public.roster_manager_approvals
  WHERE roster_id = _roster_id;

  IF NOT v_is_admin_planner AND (v_total = 0 OR v_approved_current < v_total) THEN
    RAISE EXCEPTION 'Not all teams have approved the current roster version';
  END IF;

  UPDATE public.partnership_rotation_rosters
  SET status = 'activated', updated_at = now()
  WHERE id = _roster_id;

  INSERT INTO public.roster_activity_log (roster_id, user_id, action, details)
  VALUES (_roster_id, v_actor, 'activated',
          jsonb_build_object('version', v_version, 'admin_override', v_is_admin_planner AND v_status <> 'fully_approved'));

  RETURN jsonb_build_object('success', true, 'version', v_version);
END;
$$;