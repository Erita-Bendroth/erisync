-- Add view_context column to team_view_favorites table
ALTER TABLE team_view_favorites 
ADD COLUMN IF NOT EXISTS view_context text NOT NULL DEFAULT 'schedule';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_team_view_favorites_context 
ON team_view_favorites(user_id, view_context);

-- Add a check constraint to ensure valid context values
ALTER TABLE team_view_favorites 
ADD CONSTRAINT check_view_context 
CHECK (view_context IN ('schedule', 'multi-team'));

-- Add comment for documentation
COMMENT ON COLUMN team_view_favorites.view_context IS 
'Context where the favorite was created: "schedule" for regular schedule view, "multi-team" for multi-team overview';