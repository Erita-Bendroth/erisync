UPDATE public.team_members
SET is_manager = true
WHERE team_id = '04d0efbf-20ed-4381-83de-a56c80f878e5'
  AND user_id = (SELECT user_id FROM public.profiles WHERE initials = 'HEKOT' LIMIT 1);