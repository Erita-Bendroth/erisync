-- Add missing foreign key constraint for team_members pointing to profiles
-- This completes the migration to use profiles table instead of auth.users

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;