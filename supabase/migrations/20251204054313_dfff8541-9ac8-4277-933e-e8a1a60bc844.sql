-- Add include_weekends column to roster_week_assignments
ALTER TABLE roster_week_assignments 
ADD COLUMN include_weekends BOOLEAN DEFAULT false;