-- Add submission tracking columns to roster
ALTER TABLE partnership_rotation_rosters 
ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN partnership_rotation_rosters.submitted_by IS 'User who submitted the roster for approval';
COMMENT ON COLUMN partnership_rotation_rosters.submitted_at IS 'Timestamp when the roster was submitted for approval';