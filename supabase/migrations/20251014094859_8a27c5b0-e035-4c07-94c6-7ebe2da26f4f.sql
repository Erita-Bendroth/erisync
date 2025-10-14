-- Delete all holiday schedule entries that were incorrectly created as shifts
-- Holidays should only display from the holidays table, NOT as schedule entries
DELETE FROM schedule_entries 
WHERE activity_type = 'other' 
AND notes LIKE 'Public holiday:%';