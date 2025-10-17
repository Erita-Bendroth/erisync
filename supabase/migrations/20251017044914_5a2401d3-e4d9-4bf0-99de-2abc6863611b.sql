-- Fix the revoke_manager_delegation function to properly extract team IDs from JSONB

CREATE OR REPLACE FUNCTION public.revoke_manager_delegation(
  _delegation_id uuid,
  _revoked_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delegation record;
  _granted_teams uuid[];
  _result jsonb;
  _teams_jsonb jsonb;
BEGIN
  -- Validate inputs
  IF _delegation_id IS NULL OR _revoked_by IS NULL THEN
    RAISE EXCEPTION 'All parameters are required';
  END IF;

  -- Get delegation details
  SELECT * INTO _delegation
  FROM public.manager_delegations
  WHERE id = _delegation_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delegation not found or already revoked';
  END IF;

  -- Verify the person revoking has permission (must be manager or admin)
  IF _revoked_by != _delegation.manager_id THEN
    -- Check if user is admin or planner
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _revoked_by
        AND role IN ('admin', 'planner')
    ) THEN
      RAISE EXCEPTION 'You do not have permission to revoke this delegation';
    END IF;
  END IF;

  -- Get the teams that were granted during delegation from JSONB
  SELECT details->'teams_granted' INTO _teams_jsonb
  FROM public.delegation_audit_log
  WHERE delegation_id = _delegation_id
    AND action = 'created'
  LIMIT 1;

  -- Convert JSONB array to uuid array properly
  IF _teams_jsonb IS NOT NULL AND jsonb_typeof(_teams_jsonb) = 'array' THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(_teams_jsonb)::uuid
    ) INTO _granted_teams;
  END IF;

  -- Remove temporary team access if teams were granted
  IF _granted_teams IS NOT NULL AND array_length(_granted_teams, 1) > 0 THEN
    DELETE FROM public.team_members
    WHERE user_id = _delegation.delegate_id
      AND team_id = ANY(_granted_teams)
      AND is_manager = false;
  END IF;

  -- Update delegation status
  UPDATE public.manager_delegations
  SET 
    status = 'revoked',
    revoked_at = now(),
    revoked_by = _revoked_by,
    updated_at = now()
  WHERE id = _delegation_id;

  -- Create audit log
  INSERT INTO public.delegation_audit_log (
    delegation_id,
    action,
    performed_by,
    details
  )
  VALUES (
    _delegation_id,
    'revoked',
    _revoked_by,
    jsonb_build_object(
      'revoked_at', now(),
      'teams_removed', _granted_teams
    )
  );

  -- Build result
  _result := jsonb_build_object(
    'delegation_id', _delegation_id,
    'manager_id', _delegation.manager_id,
    'delegate_id', _delegation.delegate_id,
    'teams_removed', COALESCE(array_length(_granted_teams, 1), 0),
    'success', true
  );

  RETURN _result;
END;
$$;

-- Ensure function permissions are correct
GRANT EXECUTE ON FUNCTION public.revoke_manager_delegation(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.revoke_manager_delegation IS 'Revokes a manager delegation and removes temporary team access. Properly handles JSONB array extraction and bypasses RLS for team member deletion.';