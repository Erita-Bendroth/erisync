-- Clean up incorrectly named teams that have email addresses as names
-- First, let's see what teams we have
SELECT name FROM teams WHERE name LIKE '%@%';

-- Delete teams that have email addresses as names (these are incorrectly imported)
DELETE FROM teams WHERE name LIKE '%@%';

-- The teams will be recreated correctly on the next import