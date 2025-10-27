-- Add team_ids column for multi-team support
ALTER TABLE shift_time_definitions 
ADD COLUMN team_ids uuid[] NULL;

-- Migrate existing single team_id to team_ids array
UPDATE shift_time_definitions 
SET team_ids = ARRAY[team_id]
WHERE team_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN shift_time_definitions.team_ids IS 'Multiple teams this shift time definition applies to. NULL means global.';