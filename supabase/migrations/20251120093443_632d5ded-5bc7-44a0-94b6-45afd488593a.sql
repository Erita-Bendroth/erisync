-- Add shift_time_definition_id to schedule_entries to track specific shift definitions
ALTER TABLE schedule_entries 
ADD COLUMN shift_time_definition_id UUID REFERENCES shift_time_definitions(id);

-- Create index for performance
CREATE INDEX idx_schedule_entries_shift_def 
ON schedule_entries(shift_time_definition_id);

-- Add helpful comment
COMMENT ON COLUMN schedule_entries.shift_time_definition_id IS 'References the specific shift time definition used, allowing day-specific shifts (e.g., Friday vs Mon-Thur)';

-- Backfill existing entries to match their appropriate shift definitions
-- This tries to find the best matching shift definition for existing entries
UPDATE schedule_entries se
SET shift_time_definition_id = (
  SELECT std.id
  FROM shift_time_definitions std
  WHERE se.shift_type = std.shift_type
    AND (
      std.team_id = se.team_id 
      OR std.team_ids @> ARRAY[se.team_id]
      OR (std.team_id IS NULL AND (std.team_ids IS NULL OR std.team_ids = ARRAY[]::uuid[]))
    )
    AND (
      std.day_of_week IS NULL 
      OR std.day_of_week @> ARRAY[EXTRACT(DOW FROM se.date)::int]
    )
  ORDER BY 
    CASE WHEN std.team_id = se.team_id THEN 1 ELSE 2 END,
    CASE WHEN std.day_of_week IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1
)
WHERE se.shift_time_definition_id IS NULL;