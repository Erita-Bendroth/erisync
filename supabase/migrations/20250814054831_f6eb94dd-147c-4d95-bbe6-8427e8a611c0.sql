-- Drop the conflicting unique constraint
ALTER TABLE public.schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_user_id_date_key;