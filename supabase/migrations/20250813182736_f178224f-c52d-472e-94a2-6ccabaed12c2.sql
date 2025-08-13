-- First, update Test User to be Swedish
UPDATE profiles 
SET country_code = 'SE' 
WHERE user_id = '69bf1423-b09e-4d1f-baa9-589f6a5c3583';

-- Now test a Monday schedule generation for Test User
-- Let's test for week of January 6, 2025 (which starts on Monday)
SELECT public.create_default_schedule_with_holidays(
    '69bf1423-b09e-4d1f-baa9-589f6a5c3583'::uuid,  -- Test User
    (SELECT id FROM teams LIMIT 1),                 -- First team
    '2025-01-06'::date,                            -- Monday Jan 6
    '2025-01-10'::date,                            -- Friday Jan 10
    '69bf1423-b09e-4d1f-baa9-589f6a5c3583'::uuid   -- Created by Test User
) as shifts_created;