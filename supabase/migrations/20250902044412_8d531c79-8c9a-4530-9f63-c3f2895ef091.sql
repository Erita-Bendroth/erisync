-- Create a non-overloaded wrapper to avoid PostgREST ambiguity
CREATE OR REPLACE FUNCTION public.create_default_schedule_with_holidays_v2(
  _user_id uuid,
  _team_id uuid,
  _start_date date,
  _end_date date,
  _created_by uuid,
  _country_code text,
  _region_code text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_default_schedule_with_holidays(
    _user_id,
    _team_id,
    _start_date,
    _end_date,
    _created_by,
    _country_code,
    _region_code
  );
END;
$$;

-- Grant execute to authenticated users (RLS still applies in called function)
REVOKE ALL ON FUNCTION public.create_default_schedule_with_holidays_v2(uuid, uuid, date, date, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_default_schedule_with_holidays_v2(uuid, uuid, date, date, uuid, text, text) TO authenticated;