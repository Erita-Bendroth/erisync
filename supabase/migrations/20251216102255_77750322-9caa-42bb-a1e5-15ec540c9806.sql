-- Add fza_hours column to daily_time_entries for FlexTime Withdrawal tracking
ALTER TABLE daily_time_entries 
ADD COLUMN fza_hours NUMERIC(5,2) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN daily_time_entries.fza_hours IS 'Hours withdrawn as FZA (Freizeitausgleich) - compensatory time off';