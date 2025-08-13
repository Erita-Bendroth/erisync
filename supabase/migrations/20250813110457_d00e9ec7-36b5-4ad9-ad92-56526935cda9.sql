-- Clean up teams with email addresses as names again
DELETE FROM teams WHERE name LIKE '%@%';

-- This will force teams to be recreated correctly on the next import