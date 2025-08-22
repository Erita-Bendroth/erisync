-- First, let's check if the foreign key exists and create it if needed
-- Add foreign key constraint from team_members.user_id to profiles.user_id
DO $$ 
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'team_members_user_id_fkey' 
        AND table_name = 'team_members'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE public.team_members 
        ADD CONSTRAINT team_members_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(user_id) 
        ON DELETE CASCADE;
    END IF;
END $$;