-- Create a function to mark stuck pending imports as completed
CREATE OR REPLACE FUNCTION mark_pending_imports_complete()
RETURNS TABLE(country_code text, updated_status text, holiday_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all pending 2026 imports to completed with actual holiday counts
  RETURN QUERY
  UPDATE holiday_import_status his
  SET 
    status = 'completed',
    imported_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM holidays h
      WHERE h.country_code = his.country_code
        AND h.year = his.year
        AND h.region_code IS NOT DISTINCT FROM his.region_code
        AND h.user_id IS NULL
    ), 0),
    completed_at = NOW(),
    error_message = NULL
  WHERE his.status = 'pending'
    AND his.year = 2026
  RETURNING his.country_code::text, his.status::text, his.imported_count::bigint;
END;
$$;