-- Add country_codes column to shift_time_definitions for shift assignment
-- This is separate from region_code which is used for holiday imports
ALTER TABLE shift_time_definitions 
ADD COLUMN country_codes text[] NULL;

COMMENT ON COLUMN shift_time_definitions.country_codes IS 
'Array of ISO country codes this shift applies to. NULL means applies to all countries globally. Used for automatic shift assignment based on user country_code in profiles table.';