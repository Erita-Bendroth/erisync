-- Enable the pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable the pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly 2-week schedule summary emails
-- Runs every Monday at 8:00 AM UTC
SELECT cron.schedule(
  'weekly-schedule-notifications',
  '0 8 * * 1', -- Every Monday at 8:00 AM UTC (cron format: minute hour day month day_of_week)
  $$
  SELECT
    net.http_post(
      url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/weekly-schedule-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
      body := concat('{"triggered_at": "', now(), '", "source": "cron"}')::jsonb
    ) as request_id;
  $$
);

-- Create a table to log cron job executions (optional but useful for monitoring)
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT, -- 'success', 'error', 'running'
  response_data JSONB,
  error_message TEXT
);

-- Enable RLS on the cron job logs table
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Allow planners and managers to view cron job logs
CREATE POLICY "Planners and managers can view cron logs"
ON public.cron_job_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('planner', 'manager', 'admin')
  )
);

-- Function to manually trigger the weekly notifications (for testing)
CREATE OR REPLACE FUNCTION public.trigger_weekly_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Log the manual trigger
  INSERT INTO public.cron_job_logs (job_name, status)
  VALUES ('weekly-schedule-notifications', 'running');
  
  -- Call the edge function
  SELECT net.http_post(
    url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/weekly-schedule-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '", "source": "manual"}')::jsonb
  ) INTO result;
  
  -- Update the log with the result
  UPDATE public.cron_job_logs 
  SET status = 'success', response_data = result
  WHERE job_name = 'weekly-schedule-notifications' 
  AND executed_at = (
    SELECT MAX(executed_at) 
    FROM public.cron_job_logs 
    WHERE job_name = 'weekly-schedule-notifications'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Update the log with the error
  UPDATE public.cron_job_logs 
  SET status = 'error', error_message = SQLERRM
  WHERE job_name = 'weekly-schedule-notifications' 
  AND executed_at = (
    SELECT MAX(executed_at) 
    FROM public.cron_job_logs 
    WHERE job_name = 'weekly-schedule-notifications'
  );
  
  RAISE;
END;
$$;

-- View to check cron job status
CREATE OR REPLACE VIEW public.cron_status AS
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job 
WHERE jobname = 'weekly-schedule-notifications';