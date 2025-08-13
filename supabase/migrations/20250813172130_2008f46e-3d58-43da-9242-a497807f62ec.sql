-- Create a database function to check if user has temporary password
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
$function$;