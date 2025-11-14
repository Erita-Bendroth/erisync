-- Update foreign key constraints to reference profiles table instead of auth.users
-- This fixes PostgREST relationship queries for vacation planning

-- Drop old vacation_requests constraints that point to auth.users
ALTER TABLE public.vacation_requests
  DROP CONSTRAINT IF EXISTS vacation_requests_user_id_fkey;

ALTER TABLE public.vacation_requests
  DROP CONSTRAINT IF EXISTS vacation_requests_approver_id_fkey;

ALTER TABLE public.vacation_requests
  DROP CONSTRAINT IF EXISTS vacation_requests_selected_planner_id_fkey;

-- Drop old team_members constraint that points to auth.users (keep the profiles one)
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;

-- Add new vacation_requests constraints pointing to profiles table
ALTER TABLE public.vacation_requests
  ADD CONSTRAINT vacation_requests_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

ALTER TABLE public.vacation_requests
  ADD CONSTRAINT vacation_requests_approver_id_fkey 
  FOREIGN KEY (approver_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE SET NULL;

ALTER TABLE public.vacation_requests
  ADD CONSTRAINT vacation_requests_selected_planner_id_fkey 
  FOREIGN KEY (selected_planner_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE SET NULL;