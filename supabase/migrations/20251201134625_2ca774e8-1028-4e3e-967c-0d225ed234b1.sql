-- Drop the existing CHECK constraint on roster_week_assignments.shift_type
ALTER TABLE roster_week_assignments
DROP CONSTRAINT IF EXISTS roster_week_assignments_shift_type_check;

-- Add the updated CHECK constraint with compound shift types
ALTER TABLE roster_week_assignments
ADD CONSTRAINT roster_week_assignments_shift_type_check
CHECK (shift_type IS NULL OR shift_type = ANY (ARRAY[
  'late'::text,
  'early'::text,
  'weekend'::text,
  'normal'::text,
  'off'::text,
  'weekend_normal'::text,
  'weekend_early'::text,
  'weekend_late'::text
]));