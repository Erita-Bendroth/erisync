-- Add weekend shift type for weekend/national holiday shifts
ALTER TYPE shift_type ADD VALUE IF NOT EXISTS 'weekend';