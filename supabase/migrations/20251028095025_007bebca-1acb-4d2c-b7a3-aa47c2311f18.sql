-- Fix incorrect manager assignments in parent teams
-- Child team managers should NOT be managers of their parent teams

-- Update Turbine Operations Central
-- Remove manager flag for EV, TOSTU, HEKOT (they only manage child teams)
UPDATE team_members
SET is_manager = false
WHERE team_id = '03f35821-d6b4-4bbe-81d8-318abf61072c' -- Turbine Operations Central
  AND user_id IN (
    '7f679efb-dfc1-491a-af33-e42c0529c5ce',  -- EV
    '74377a40-2ac8-4d03-9199-b24eb35ac17c',  -- TOSTU
    'a2822009-99a8-4747-8cbc-188d1138f8a0'   -- HEKOT
  )
  AND is_manager = true;

-- Update Turbine Operations North
-- Remove manager flag for HADJO, JEBOG, STPKO (they only manage child teams)
UPDATE team_members
SET is_manager = false
WHERE team_id = '40df8223-5d71-4bc1-8fd6-620a2a407bb6' -- Turbine Operations North
  AND user_id IN (
    '98c226ca-46ac-4a0e-a5ca-c37553edbe31',  -- HADJO
    '70e5f06a-0032-4454-9dc3-e70d37566e27',  -- JEBOG
    '44f7c1c2-f46d-4226-b60f-5c96c815e7ae'   -- STPKO
  )
  AND is_manager = true;

-- Check for similar issues in Turbine Operations Offshore
UPDATE team_members tm
SET is_manager = false
WHERE tm.team_id IN (
  SELECT t.id 
  FROM teams t 
  WHERE t.name = 'Turbine Operations Offshore' 
  AND t.parent_team_id IS NULL
)
AND tm.is_manager = true
AND tm.user_id IN (
  SELECT DISTINCT tm_child.user_id
  FROM team_members tm_child
  JOIN teams t_child ON t_child.id = tm_child.team_id
  WHERE t_child.parent_team_id = tm.team_id
  AND tm_child.is_manager = true
);