-- Step 1: Remove the default value temporarily
ALTER TABLE schedule_entries ALTER COLUMN activity_type DROP DEFAULT;

-- Step 2: Create new enum type without 'sick'
CREATE TYPE activity_type_new AS ENUM (
  'work', 
  'vacation', 
  'other', 
  'hotline_support', 
  'out_of_office', 
  'training', 
  'flextime', 
  'working_from_home'
);

-- Step 3: Update the schedule_entries table to use the new enum
-- Map 'sick' to 'other' during the conversion
ALTER TABLE schedule_entries 
  ALTER COLUMN activity_type TYPE activity_type_new
  USING (
    CASE 
      WHEN activity_type::text = 'sick' THEN 'other'::activity_type_new
      ELSE activity_type::text::activity_type_new
    END
  );

-- Step 4: Drop the old enum type and rename new one
DROP TYPE activity_type;
ALTER TYPE activity_type_new RENAME TO activity_type;

-- Step 5: Restore the default value (using 'work')
ALTER TABLE schedule_entries ALTER COLUMN activity_type SET DEFAULT 'work'::activity_type;