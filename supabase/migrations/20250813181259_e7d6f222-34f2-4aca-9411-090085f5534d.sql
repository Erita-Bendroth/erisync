-- Remove the global unique constraint that's causing conflicts
-- Keep only the user-specific constraint
ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_country_code_key;