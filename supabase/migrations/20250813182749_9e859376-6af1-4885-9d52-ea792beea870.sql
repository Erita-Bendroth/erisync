-- Check what was created including the Monday
SELECT 
    date,
    EXTRACT(ISODOW FROM date) as day_of_week,
    TO_CHAR(date, 'Day') as day_name,
    activity_type,
    user_id
FROM public.schedule_entries 
WHERE user_id = '69bf1423-b09e-4d1f-baa9-589f6a5c3583'
AND date BETWEEN '2025-01-06' AND '2025-01-10'
ORDER BY date;