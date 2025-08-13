-- Add unique constraint to holidays table to support ON CONFLICT
-- This will prevent duplicate holidays for the same date, country, and user
ALTER TABLE public.holidays 
ADD CONSTRAINT holidays_date_country_user_unique 
UNIQUE (date, country_code, user_id);