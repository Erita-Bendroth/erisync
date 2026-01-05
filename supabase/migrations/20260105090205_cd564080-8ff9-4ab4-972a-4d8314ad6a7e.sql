-- Delete duplicate holidays keeping only one entry per date/country/region combination
-- Use ctid to identify rows and a subquery to find duplicates
DELETE FROM public.holidays
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY date, country_code, COALESCE(region_code, '')
             ORDER BY created_at ASC
           ) as rn
    FROM public.holidays
  ) sub
  WHERE rn > 1
);

-- Now add the unique constraint for holiday upserts
CREATE UNIQUE INDEX holidays_unique_date_country_region 
ON public.holidays (date, country_code, COALESCE(region_code, ''));