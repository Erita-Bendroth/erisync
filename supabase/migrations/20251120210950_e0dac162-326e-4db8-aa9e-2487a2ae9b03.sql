-- Fix holidays table unique constraints to prevent duplicates
-- First, clean up ALL existing duplicates across all countries
DELETE FROM holidays 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY date, country_code, year, 
                          COALESCE(region_code, 'NULL'), 
                          COALESCE(user_id::text, 'NULL')
             ORDER BY created_at
           ) as rn
    FROM holidays
  ) t
  WHERE rn > 1
);

-- Drop existing problematic constraint
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_date_country_year_region_user_key;

-- Create specific unique indexes that properly handle NULL values
-- For holidays with both region and user (personal regional holidays)
CREATE UNIQUE INDEX IF NOT EXISTS holidays_unique_region_user_idx 
ON holidays (date, country_code, year, region_code, user_id)
WHERE region_code IS NOT NULL AND user_id IS NOT NULL;

-- For personal holidays with no region
CREATE UNIQUE INDEX IF NOT EXISTS holidays_unique_user_no_region_idx 
ON holidays (date, country_code, year, user_id)
WHERE region_code IS NULL AND user_id IS NOT NULL;

-- For public regional holidays (most important - prevents UK duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS holidays_unique_public_region_idx 
ON holidays (date, country_code, year, region_code)
WHERE user_id IS NULL AND region_code IS NOT NULL;

-- For public national holidays with no region
CREATE UNIQUE INDEX IF NOT EXISTS holidays_unique_public_no_region_idx 
ON holidays (date, country_code, year)
WHERE user_id IS NULL AND region_code IS NULL;