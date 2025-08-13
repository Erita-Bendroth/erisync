-- Find Test User and check their setup
SELECT 
    p.user_id, 
    p.first_name, 
    p.last_name, 
    p.country_code,
    ur.role
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
WHERE p.first_name ILIKE '%test%' OR p.last_name ILIKE '%test%' OR p.first_name ILIKE '%user%';