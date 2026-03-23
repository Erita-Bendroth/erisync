-- 1. Update trigger to extract initials from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email, initials)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', COALESCE(NEW.raw_user_meta_data ->> 'initials', '')),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
        NEW.email,
        NEW.raw_user_meta_data ->> 'initials'
    );
    RETURN NEW;
END;
$$;

-- 2. Backfill existing profiles where initials are missing but first_name has a value
UPDATE public.profiles
SET initials = first_name
WHERE (initials IS NULL OR initials = '')
  AND first_name IS NOT NULL
  AND first_name != '';