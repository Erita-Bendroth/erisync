-- Ensure profiles.user_id is unique for reliable relationships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add a direct FK from team_members.user_id -> profiles.user_id with a DISTINCT name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_user_id_profiles_fkey' 
      AND table_name = 'team_members'
  ) THEN
    ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_user_id_profiles_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(user_id)
    ON DELETE CASCADE;
  END IF;
END $$;