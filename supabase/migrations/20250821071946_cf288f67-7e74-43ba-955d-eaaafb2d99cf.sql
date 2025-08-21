-- Disable the automatic weekly cron job
SELECT cron.unschedule('weekly-schedule-notifications');

-- Keep the function and logs table for manual triggering, but remove the automatic schedule