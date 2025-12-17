-- Add initial flextime balance column for users starting mid-year
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS initial_flextime_balance NUMERIC(6,2) DEFAULT 0;

COMMENT ON COLUMN profiles.initial_flextime_balance IS 
  'One-time seed balance for users starting mid-year with accumulated flex hours';