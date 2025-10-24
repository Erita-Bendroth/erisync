-- Change day_of_week from single integer to array of integers to support multiple days
-- First, create a temporary column to store the array
ALTER TABLE shift_time_definitions 
ADD COLUMN days_of_week integer[];

-- Migrate existing single day values to array format
UPDATE shift_time_definitions 
SET days_of_week = ARRAY[day_of_week]
WHERE day_of_week IS NOT NULL;

-- Drop the old column
ALTER TABLE shift_time_definitions 
DROP COLUMN day_of_week;

-- Rename the new column
ALTER TABLE shift_time_definitions 
RENAME COLUMN days_of_week TO day_of_week;