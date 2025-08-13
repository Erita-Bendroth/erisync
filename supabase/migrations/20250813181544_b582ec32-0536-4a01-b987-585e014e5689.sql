-- Check the current database function to see the day-of-week logic
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'create_default_schedule_with_holidays';