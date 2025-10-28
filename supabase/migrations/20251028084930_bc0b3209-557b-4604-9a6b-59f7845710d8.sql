-- Fix team hierarchy: Ensure Turbine Troubleshooting Central - North, West has correct parent
UPDATE teams
SET parent_team_id = '03f35821-d6b4-4bbe-81d8-318abf61072c'
WHERE id = '04d0efbf-20ed-4381-83de-a56c80f878e5'
AND parent_team_id IS DISTINCT FROM '03f35821-d6b4-4bbe-81d8-318abf61072c';

-- Add HEKOT as manager of Turbine Operations Central
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '03f35821-d6b4-4bbe-81d8-318abf61072c',
  'a2822009-99a8-4747-8cbc-188d1138f8a0',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Add EV as manager of Turbine Operations Central
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '03f35821-d6b4-4bbe-81d8-318abf61072c',
  '7f679efb-dfc1-491a-af33-e42c0529c5ce',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Add TOSTU as manager of Turbine Operations Central
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '03f35821-d6b4-4bbe-81d8-318abf61072c',
  '74377a40-2ac8-4d03-9199-b24eb35ac17c',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;