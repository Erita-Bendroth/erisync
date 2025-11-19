-- Migration to fix incorrect day_of_week values in shift_time_definitions
-- Corrects the mapping to match JavaScript Date.getDay() standard (0=Sunday, 1=Monday, etc.)

-- Fix Monday-Friday mappings: [0,1,2,3,4] -> [1,2,3,4,5]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[1,2,3,4,5]
WHERE day_of_week = ARRAY[0,1,2,3,4];

-- Fix Saturday-Sunday mappings: [5,6] -> [6,0]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[6,0]
WHERE day_of_week = ARRAY[5,6];

-- Fix Saturday-Sunday alternative order: [6,5] -> [0,6]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[0,6]
WHERE day_of_week = ARRAY[6,5];

-- Fix individual Monday: [0] -> [1]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[1]
WHERE day_of_week = ARRAY[0] AND array_length(day_of_week, 1) = 1;

-- Fix individual Tuesday: [1] -> [2]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[2]
WHERE day_of_week = ARRAY[1] AND array_length(day_of_week, 1) = 1;

-- Fix individual Wednesday: [2] -> [3]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[3]
WHERE day_of_week = ARRAY[2] AND array_length(day_of_week, 1) = 1;

-- Fix individual Thursday: [3] -> [4]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[4]
WHERE day_of_week = ARRAY[3] AND array_length(day_of_week, 1) = 1;

-- Fix individual Friday: [4] -> [5]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[5]
WHERE day_of_week = ARRAY[4] AND array_length(day_of_week, 1) = 1;

-- Fix individual Saturday: [5] -> [6]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[6]
WHERE day_of_week = ARRAY[5] AND array_length(day_of_week, 1) = 1;

-- Fix individual Sunday: [6] -> [0]
UPDATE shift_time_definitions
SET day_of_week = ARRAY[0]
WHERE day_of_week = ARRAY[6] AND array_length(day_of_week, 1) = 1;