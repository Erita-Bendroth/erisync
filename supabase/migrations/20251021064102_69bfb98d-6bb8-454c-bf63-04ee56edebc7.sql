-- Add composite index for faster holiday lookups during import
-- This speeds up conflict detection during upsert operations
CREATE INDEX IF NOT EXISTS idx_holidays_import_lookup 
ON holidays (country_code, year, date, region_code) 
WHERE user_id IS NULL;

-- Add index on country_code and year for faster filtering
CREATE INDEX IF NOT EXISTS idx_holidays_country_year 
ON holidays (country_code, year) 
WHERE user_id IS NULL;