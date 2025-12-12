-- Add metadata column to schedule_entries for tracking generation options
ALTER TABLE public.schedule_entries 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for efficient querying of skip_holidays flag
CREATE INDEX IF NOT EXISTS idx_schedule_entries_metadata_skip_holidays 
ON public.schedule_entries ((metadata->>'skip_holidays'));

-- Add comment for documentation
COMMENT ON COLUMN public.schedule_entries.metadata IS 'Stores generation options like skip_holidays:true to enable automatic cleanup when holidays are imported for the user''s location';