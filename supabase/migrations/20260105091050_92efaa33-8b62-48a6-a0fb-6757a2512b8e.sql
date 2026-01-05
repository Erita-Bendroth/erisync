UPDATE public.holiday_import_status 
SET status = 'failed', error_message = 'Reset stuck import - manual cleanup' 
WHERE country_code = 'AT' AND year = 2026 AND status IN ('pending', 'in_progress')