-- Add responsibility_region column to duty_assignments table
ALTER TABLE duty_assignments 
ADD COLUMN responsibility_region TEXT;

COMMENT ON COLUMN duty_assignments.responsibility_region IS 'The region or country this person is responsible for (e.g., South, East, North West, AT, SE, etc.)';