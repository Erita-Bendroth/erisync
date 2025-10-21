-- Directly update all stuck pending imports for 2026 to completed
-- Match them with actual holiday counts from the holidays table
UPDATE holiday_import_status
SET 
  status = 'completed',
  completed_at = NOW(),
  error_message = NULL,
  imported_count = COALESCE((
    SELECT COUNT(*)::integer
    FROM holidays h
    WHERE h.country_code = holiday_import_status.country_code
      AND h.year = holiday_import_status.year
      AND h.region_code IS NOT DISTINCT FROM holiday_import_status.region_code
      AND h.user_id IS NULL
  ), 0)
WHERE status = 'pending'
  AND year = 2026;