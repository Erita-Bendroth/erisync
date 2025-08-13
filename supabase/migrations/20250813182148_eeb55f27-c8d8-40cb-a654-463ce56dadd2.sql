-- Test the day of week calculation to debug Monday issue
SELECT 
    date_val,
    EXTRACT(DOW FROM date_val) as dow_sunday_0,
    EXTRACT(ISODOW FROM date_val) as isodow_monday_1,
    CASE WHEN EXTRACT(ISODOW FROM date_val) BETWEEN 1 AND 5 THEN 'weekday' ELSE 'weekend' END as day_type
FROM (
    SELECT generate_series('2025-01-06'::date, '2025-01-12'::date, '1 day'::interval)::date as date_val
) dates
ORDER BY date_val;