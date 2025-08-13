-- Add unique constraint to schedule_entries to prevent duplicate entries per user per date per team
ALTER TABLE public.schedule_entries 
ADD CONSTRAINT schedule_entries_user_date_team_unique 
UNIQUE (user_id, date, team_id);