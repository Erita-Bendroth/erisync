-- Ensure pg_cron job exists for daily auto-assign of holidays
DO $$
BEGIN
  -- Unschedule existing job if present
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-assign-holidays-daily') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'auto-assign-holidays-daily'));
  END IF;
END $$;

select
cron.schedule(
  'auto-assign-holidays-daily',
  '0 3 * * *', -- every day at 03:00 UTC
  $$
  select
    net.http_post(
      url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/auto-assign-holidays',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
      body := jsonb_build_object('triggered_at', now())
    ) as request_id;
  $$
);
