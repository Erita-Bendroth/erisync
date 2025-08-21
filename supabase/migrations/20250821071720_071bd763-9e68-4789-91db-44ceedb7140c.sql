-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if it exists and recreate it
SELECT cron.unschedule('weekly-schedule-notifications');

-- Schedule weekly 2-week schedule summary emails
-- Runs every Monday at 8:00 AM UTC
SELECT cron.schedule(
  'weekly-schedule-notifications',
  '0 8 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/weekly-schedule-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
      body := concat('{"triggered_at": "', now(), '", "source": "cron"}')::jsonb
    ) as request_id;
  $$
);