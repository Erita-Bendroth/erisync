-- Debug: Check what RLS policies exist for holidays table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'holidays';