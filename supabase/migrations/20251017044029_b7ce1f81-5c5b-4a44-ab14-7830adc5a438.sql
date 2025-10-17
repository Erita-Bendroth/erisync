-- Create a security definer function to handle delegation creation
-- This bypasses RLS to allow granting temporary team access

CREATE OR REPLACE FUNCTION public.create_manager_delegation(
  _manager_id uuid,
  _delegate_id uuid,
  _start_date timestamp with time zone,
  _end_date timestamp with time zone
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

  -- Grant temporary team access if needed
  IF _missing_teams IS NOT NULL AND array_length(_missing_teams, 1) > 0 THEN
    FOREACH _team_id IN ARRAY _missing_teams
    LOOP
      INSERT INTO public.team_members (user_id, team_id, is_manager)
      VALUES (_delegate_id, _team_id, false)
      ON CONFLICT DO NOTHING;
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_manager_delegation(uuid, uuid, timestamp with time zone, timestamp with time zone) TO authenticated;

COMMENT ON FUNCTION public.create_manager_delegation IS 'Creates a manager delegation and automatically grants temporary team access. Bypasses RLS for team member insertion.';