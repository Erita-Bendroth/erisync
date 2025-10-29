-- Create storage bucket for email screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-screenshots', 'email-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policy for authenticated users to upload screenshots
CREATE POLICY "Users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-screenshots');

-- Set up RLS policy for authenticated users to view screenshots
CREATE POLICY "Users can view screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'email-screenshots');

-- Set up RLS policy for users to delete their own screenshots
CREATE POLICY "Users can delete their screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'email-screenshots' AND owner = auth.uid());