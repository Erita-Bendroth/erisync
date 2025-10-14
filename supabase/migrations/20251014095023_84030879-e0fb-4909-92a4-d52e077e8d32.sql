-- Delete all shifts scheduled on weekends (Saturday = 6, Sunday = 7)
DELETE FROM schedule_entries 
WHERE EXTRACT(ISODOW FROM date) IN (6, 7);

-- Delete all shifts scheduled on public holidays matching the user's country and region
-- This needs to check each user's country/region and delete shifts on their applicable holidays
DELETE FROM schedule_entries se
WHERE EXISTS (
  SELECT 1 FROM holidays h
  INNER JOIN profiles p ON se.user_id = p.user_id
  WHERE h.date = se.date
    AND h.country_code = p.country_code
    AND h.is_public = true
    AND h.user_id IS NULL
    AND (
      -- National holidays (no region specified)
      h.region_code IS NULL
      -- Regional holidays matching user's region (only for Germany)
      OR (p.country_code = 'DE' AND h.region_code = p.region_code AND p.region_code IS NOT NULL)
    )
);