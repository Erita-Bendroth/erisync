-- Assign admin role to erbet@vestas.com
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles 
WHERE email = 'erbet@vestas.com'
ON CONFLICT (user_id, role) DO NOTHING;