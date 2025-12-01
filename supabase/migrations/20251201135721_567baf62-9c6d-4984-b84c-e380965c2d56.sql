-- Drop the duplicate foreign key constraint from team_members table
-- This resolves the ambiguous foreign key issue when joining with profiles
ALTER TABLE team_members 
DROP CONSTRAINT IF EXISTS team_members_user_id_profiles_fkey;