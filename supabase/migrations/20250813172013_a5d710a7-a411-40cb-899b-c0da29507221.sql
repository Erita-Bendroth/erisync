-- Create an edge function to check if user has temporary password
-- We'll create this as a database function first that the edge function can call

CREATE OR REPLACE FUNCTION public.check_temporary_password(_user_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  temp_password TEXT := 'VestasTemp2025!';
BEGIN
  -- This function will be called by the edge function to verify the password
  -- The actual password verification will happen in the edge function
  -- This function just stores the temporary password for comparison
  RETURN _password = temp_password;
END;
$function$

-- Update profiles table to ensure requires_password_change field is properly set
-- The field already exists, but let's make sure it has the right default
ALTER TABLE public.profiles 
ALTER COLUMN requires_password_change SET DEFAULT false;