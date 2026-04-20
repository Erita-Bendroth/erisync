
-- A. Normalize UK -> GB in shift_time_definitions.country_codes
UPDATE public.shift_time_definitions
SET country_codes = ARRAY(
  SELECT DISTINCT CASE WHEN upper(c) = 'UK' THEN 'GB' ELSE upper(c) END
  FROM unnest(country_codes) AS c
)
WHERE country_codes IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(country_codes) c WHERE upper(c) = 'UK');

-- B. Clear stale shift_time_definition_id on weekend entries pointing at non-weekend defs
UPDATE public.schedule_entries se
SET shift_time_definition_id = NULL
FROM public.shift_time_definitions std
WHERE se.shift_time_definition_id = std.id
  AND se.shift_type = 'weekend'
  AND std.shift_type <> 'weekend';

-- C. Downgrade invalid weekend assignments on weekdays that are NOT a public holiday for the member's country
WITH bad AS (
  SELECT se.id
  FROM public.schedule_entries se
  JOIN public.profiles p ON p.user_id = se.user_id
  WHERE se.shift_type = 'weekend'
    AND se.activity_type = 'work'
    AND EXTRACT(ISODOW FROM se.date) BETWEEN 1 AND 5  -- Mon-Fri
    AND NOT EXISTS (
      SELECT 1 FROM public.holidays h
      WHERE h.date = se.date
        AND h.is_public = true
        AND h.user_id IS NULL
        AND CASE WHEN upper(h.country_code) = 'UK' THEN 'GB' ELSE upper(h.country_code) END
            = CASE WHEN upper(coalesce(p.country_code, '')) = 'UK' THEN 'GB' ELSE upper(coalesce(p.country_code, '')) END
    )
)
UPDATE public.schedule_entries
SET shift_type = 'normal',
    shift_time_definition_id = NULL
WHERE id IN (SELECT id FROM bad);
