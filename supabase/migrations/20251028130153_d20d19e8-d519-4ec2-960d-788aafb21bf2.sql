-- Update the delegation function to grant full manager rights (is_manager = true)
CREATE OR REPLACE FUNCTION public.create_manager_delegation(
  _manager_id uuid,
  _delegate_id uuid,
  _start_date timestamptz,
  _end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delegation_id uuid;
  _delegator_teams uuid[];
  _delegate_teams uuid[];
  _missing_teams uuid[];
  _team_id uuid;
  _result jsonb;
BEGIN
  -- Validate inputs
  IF _manager_id IS NULL OR _delegate_id IS NULL OR _start_date IS NULL OR _end_date IS NULL THEN
    RAISE EXCEPTION 'All parameters are required';
  END IF;

  IF _end_date <= _start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF _manager_id = _delegate_id THEN
    RAISE EXCEPTION 'Cannot delegate to yourself';
  END IF;

  -- Get delegator's managed teams
  SELECT array_agg(team_id)
  INTO _delegator_teams
  FROM public.team_members
  WHERE user_id = _manager_id AND is_manager = true;

  IF _delegator_teams IS NULL OR array_length(_delegator_teams, 1) = 0 THEN
    RAISE EXCEPTION 'Delegator has no managed teams';
  END IF;

  -- Get delegate's current teams
  SELECT array_agg(team_id)
  INTO _delegate_teams
  FROM public.team_members
  WHERE user_id = _delegate_id;

  -- Calculate missing teams (teams delegate doesn't have access to)
  IF _delegate_teams IS NULL THEN
    _missing_teams := _delegator_teams;
  ELSE
    SELECT array_agg(t)
    INTO _missing_teams
    FROM unnest(_delegator_teams) t
    WHERE t != ALL(_delegate_teams);
  END IF;

  -- Grant temporary MANAGER access with full rights (is_manager = true)
  IF _missing_teams IS NOT NULL AND array_length(_missing_teams, 1) > 0 THEN
    FOREACH _team_id IN ARRAY _missing_teams
    LOOP
      INSERT INTO public.team_members (user_id, team_id, is_manager)
      VALUES (_delegate_id, _team_id, true)
      ON CONFLICT (user_id, team_id) 
      DO UPDATE SET is_manager = true;
    END LOOP;
  END IF;

  -- Create delegation record
  INSERT INTO public.manager_delegations (
    manager_id,
    delegate_id,
    start_date,
    end_date,
    status
  )
  VALUES (
    _manager_id,
    _delegate_id,
    _start_date,
    _end_date,
    'active'
  )
  RETURNING id INTO _delegation_id;

  -- Create audit log
  INSERT INTO public.delegation_audit_log (
    delegation_id,
    action,
    performed_by,
    details
  )
  VALUES (
    _delegation_id,
    'created',
    _manager_id,
    jsonb_build_object(
      'delegate_id', _delegate_id,
      'start_date', _start_date,
      'end_date', _end_date,
      'teams_granted', _missing_teams
    )
  );

  -- Build result
  _result := jsonb_build_object(
    'delegation_id', _delegation_id,
    'teams_granted', COALESCE(array_length(_missing_teams, 1), 0),
    'granted_team_ids', COALESCE(_missing_teams, ARRAY[]::uuid[])
  );

  RETURN _result;
END;
$$;

-- Add function to cleanup expired delegations and remove temporary manager access
CREATE OR REPLACE FUNCTION public.cleanup_expired_delegations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark expired delegations as expired
  UPDATE public.manager_delegations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND end_date < now();
END;
$$;