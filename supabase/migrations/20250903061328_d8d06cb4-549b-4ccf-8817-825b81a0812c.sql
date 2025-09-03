-- Add trigger to auto-assign holidays when user location changes
CREATE OR REPLACE FUNCTION public.trigger_holiday_reassignment_on_location_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When user's country or region changes, trigger holiday reassignment
  IF (OLD.country_code != NEW.country_code OR OLD.region_code != NEW.region_code) THEN
    -- Call the auto-assign holidays function
    PERFORM net.http_post(
      url := 'https://rdatyftacldjhgzsxzfw.supabase.co/functions/v1/auto-assign-holidays',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYXR5ZnRhY2xkamhnenN4emZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNzEzMDQsImV4cCI6MjA3MDY0NzMwNH0.pZhT4TpcdKya4csoNRN0NeO5Rear50yqbmGirGLTrlQ"}'::jsonb,
      body := jsonb_build_object('user_id', NEW.user_id, 'triggered_by', 'location_change')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_location_change ON public.profiles;
CREATE TRIGGER on_profile_location_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_holiday_reassignment_on_location_change();