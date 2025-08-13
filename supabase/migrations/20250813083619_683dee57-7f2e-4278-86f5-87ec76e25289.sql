-- Add a field to profiles to track if user needs to change password
ALTER TABLE public.profiles 
ADD COLUMN requires_password_change BOOLEAN DEFAULT false;