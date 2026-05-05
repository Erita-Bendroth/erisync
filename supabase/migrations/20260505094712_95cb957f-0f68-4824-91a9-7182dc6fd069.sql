
UPDATE public.daily_time_entries
SET flextime_delta = sub.new_delta,
    updated_at = now()
FROM (
  SELECT
    id,
    (
      -- actual hours, with break only deducted when gross > 6h
      CASE
        WHEN (EXTRACT(EPOCH FROM (work_end_time - work_start_time)) / 3600.0) > 6
          THEN (EXTRACT(EPOCH FROM (work_end_time - work_start_time)) / 3600.0)
               - (COALESCE(break_duration_minutes, 0) / 60.0)
        ELSE (EXTRACT(EPOCH FROM (work_end_time - work_start_time)) / 3600.0)
      END
    )
    -
    (
      -- target hours by weekday (ISO: 1=Mon..7=Sun)
      CASE EXTRACT(ISODOW FROM entry_date)::int
        WHEN 1 THEN 8.0
        WHEN 2 THEN 8.0
        WHEN 3 THEN 8.0
        WHEN 4 THEN 8.0
        WHEN 5 THEN 6.0
        ELSE 0.0
      END
    ) AS new_delta
  FROM public.daily_time_entries
  WHERE entry_type <> 'fza_withdrawal'
    AND work_start_time IS NOT NULL
    AND work_end_time IS NOT NULL
) sub
WHERE public.daily_time_entries.id = sub.id;
