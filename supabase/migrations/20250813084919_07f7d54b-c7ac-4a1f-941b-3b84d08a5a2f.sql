-- Add 'admin' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'admin';

-- Assign admin role to erbet@vestas.com
-- First, get the user_id for erbet@vestas.com from profiles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles 
WHERE email = 'erbet@vestas.com'
ON CONFLICT (user_id, role) DO NOTHING;