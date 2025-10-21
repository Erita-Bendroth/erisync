-- Drop the old constraint
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_date_country_user_unique;

-- Create a partial unique index that handles NULL values properly for region_code and user_id
-- This allows multiple entries with different region codes or user IDs
CREATE UNIQUE INDEX holidays_date_country_region_user_unique 
ON holidays (date, country_code, region_code, user_id);