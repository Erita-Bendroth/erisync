-- Add flextime carryover limit to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS flextime_carryover_limit NUMERIC(5,2) DEFAULT 40.00;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.flextime_carryover_limit IS 'Personal flextime carryover limit in hours (default 40h based on German regulations)';