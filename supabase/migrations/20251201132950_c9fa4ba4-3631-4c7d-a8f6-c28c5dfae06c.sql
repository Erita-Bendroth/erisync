-- Add shift_type column to roster_week_assignments to support per-person shift assignment
ALTER TABLE roster_week_assignments
ADD COLUMN shift_type TEXT CHECK (shift_type IN ('late', 'early', 'weekend', 'normal', 'off'));

-- Update the unique constraint to allow multiple assignments per week (different people)
-- But keep constraint that same person can't have multiple assignments same week
ALTER TABLE roster_week_assignments
DROP CONSTRAINT IF EXISTS roster_week_assignments_roster_id_week_number_user_id_key;

-- Add new constraint: one assignment per person per week per roster
ALTER TABLE roster_week_assignments
ADD CONSTRAINT roster_week_assignments_unique_person_week 
UNIQUE (roster_id, week_number, user_id);