-- Add is_substitute field to duty_assignments to distinguish primary from backup assignments
ALTER TABLE duty_assignments 
ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN DEFAULT false;

-- Migrate existing substitute_user_id entries to separate rows with is_substitute=true
INSERT INTO duty_assignments (
  team_id, user_id, duty_type, week_number, year, date, 
  created_by, created_at, updated_at, responsibility_region, is_substitute, notes
)
SELECT 
  team_id, substitute_user_id, duty_type, week_number, year, date,
  created_by, created_at, updated_at, NULL, true, 'Migrated from substitute_user_id'
FROM duty_assignments
WHERE substitute_user_id IS NOT NULL;

-- Remove substitute_user_id column as it's no longer needed with the new multi-assignment structure
ALTER TABLE duty_assignments DROP COLUMN IF EXISTS substitute_user_id;

-- Add comment explaining the new structure
COMMENT ON COLUMN duty_assignments.is_substitute IS 'Indicates if this is a substitute/backup assignment. Multiple assignments can exist for the same date/team/duty_type combination.';