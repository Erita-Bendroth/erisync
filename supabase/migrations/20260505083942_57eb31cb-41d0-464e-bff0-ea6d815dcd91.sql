
-- 1. Security-definer function to resolve creator display names (any user)
CREATE OR REPLACE FUNCTION public.get_user_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      NULLIF(p.initials, ''),
      NULLIF(p.first_name, ''),
      'System'
    ) AS display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_names(uuid[]) TO authenticated;

-- 2. Fix AMT's 4 short-workday entries (clamp negative deltas from non-FZA entries to 0)
UPDATE public.daily_time_entries
SET flextime_delta = 0,
    updated_at = now()
WHERE user_id = '4c6e0211-87d0-41c2-b3f4-5df8e974a4c0'
  AND entry_type <> 'fza_withdrawal'
  AND flextime_delta < 0;

-- 3. Recompute AMT's monthly_flextime_summary based on initial balance + corrected deltas
DO $$
DECLARE
  v_user uuid := '4c6e0211-87d0-41c2-b3f4-5df8e974a4c0';
  v_initial numeric;
  v_running numeric;
  r RECORD;
BEGIN
  SELECT COALESCE(initial_flextime_balance, 0) INTO v_initial
  FROM public.profiles WHERE user_id = v_user;

  v_running := COALESCE(v_initial, 0);

  DELETE FROM public.monthly_flextime_summary WHERE user_id = v_user;

  FOR r IN
    SELECT EXTRACT(YEAR FROM entry_date)::int AS y,
           EXTRACT(MONTH FROM entry_date)::int AS m,
           COALESCE(SUM(flextime_delta), 0) AS month_delta
    FROM public.daily_time_entries
    WHERE user_id = v_user
    GROUP BY 1, 2
    ORDER BY 1, 2
  LOOP
    INSERT INTO public.monthly_flextime_summary
      (user_id, year, month, starting_balance, month_delta, ending_balance)
    VALUES
      (v_user, r.y, r.m, v_running, r.month_delta, v_running + r.month_delta);
    v_running := v_running + r.month_delta;
  END LOOP;
END $$;
