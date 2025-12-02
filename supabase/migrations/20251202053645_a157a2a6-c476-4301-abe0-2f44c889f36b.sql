-- Add day_of_week column to roster_week_assignments for day-specific assignments
-- When NULL, assignment applies to whole week (backward compatible)
-- When set (0-6 where 0=Sunday, 1=Monday, etc.), assignment applies only to that day
ALTER TABLE roster_week_assignments
ADD COLUMN day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6);

COMMENT ON COLUMN roster_week_assignments.day_of_week IS 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday). NULL means whole week.';

-- Add index for efficient lookups
CREATE INDEX idx_roster_week_assignments_day_of_week ON roster_week_assignments(roster_id, week_number, day_of_week);