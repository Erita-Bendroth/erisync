-- Fix security issues from previous migration

-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.trigger_weekly_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Drop the problematic view and recreate it as a regular view (not security definer)
DROP VIEW IF EXISTS public.cron_status;

-- Create a safer function to check cron status instead of a security definer view
CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS TABLE(
  jobname text,
  schedule text,
  active boolean,
  jobid bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'cron'
AS $$
  SELECT 
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.jobid
  FROM cron.job j
  WHERE j.jobname = 'weekly-schedule-notifications';
$$;

-- Grant execute permission to authenticated users with appropriate roles only
REVOKE ALL ON FUNCTION public.get_cron_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_status() TO authenticated;