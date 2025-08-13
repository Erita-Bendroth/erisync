-- Debug existing schedule entries to see why Mondays might be missing
SELECT 
    date,
    EXTRACT(ISODOW FROM date) as day_of_week,
    TO_CHAR(date, 'Day') as day_name,
    COUNT(*) as entry_count
FROM public.schedule_entries 
WHERE date >= '2025-01-01' AND date <= '2025-01-31'
GROUP BY date, EXTRACT(ISODOW FROM date)
ORDER BY date;