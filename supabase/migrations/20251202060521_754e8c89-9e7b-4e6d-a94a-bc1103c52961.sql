-- Fix roster_week_assignments unique constraint to support day-by-day mode
-- Drop the old constraint that doesn't account for day_of_week
ALTER TABLE roster_week_assignments 
DROP CONSTRAINT IF EXISTS roster_week_assignments_unique_person_week;

-- Create a new unique index that properly handles both week-level and day-level assignments
-- Using COALESCE(day_of_week, -1) ensures:
-- - Week mode (day_of_week = NULL): Uses -1, allowing one "week-level" assignment per user
-- - Day mode (day_of_week = 0-6): Each day is unique
CREATE UNIQUE INDEX roster_week_assignments_unique_person_week_day 
ON roster_week_assignments (roster_id, week_number, user_id, team_id, COALESCE(day_of_week, -1));