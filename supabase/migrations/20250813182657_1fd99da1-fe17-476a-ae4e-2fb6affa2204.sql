-- Test the schedule generation function directly for a specific user
-- First, let's see what users and profiles exist
SELECT 
    p.user_id, 
    p.first_name, 
    p.last_name, 
    p.country_code,
    ur.role
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
LIMIT 5;