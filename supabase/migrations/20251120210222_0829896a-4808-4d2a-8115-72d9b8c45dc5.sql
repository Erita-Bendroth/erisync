-- Enable realtime for holidays table
ALTER TABLE public.holidays REPLICA IDENTITY FULL;

-- Verify holidays table is in realtime publication
-- This will add it if not already present
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'holidays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
  END IF;
END $$;