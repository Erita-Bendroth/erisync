-- Make user_id nullable in duty_assignments table to allow "Unassigned" status
ALTER TABLE duty_assignments 
ALTER COLUMN user_id DROP NOT NULL;

-- Add comment explaining the nullable constraint
COMMENT ON COLUMN duty_assignments.user_id IS 'User assigned to duty. Can be NULL for unassigned duties.';