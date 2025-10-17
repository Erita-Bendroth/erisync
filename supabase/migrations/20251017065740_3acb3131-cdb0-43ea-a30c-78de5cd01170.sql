-- Add theme preference column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme_preference TEXT 
CHECK (theme_preference IN ('light', 'dark', 'system')) 
DEFAULT 'system';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.theme_preference IS 'User theme preference: light, dark, or system';
