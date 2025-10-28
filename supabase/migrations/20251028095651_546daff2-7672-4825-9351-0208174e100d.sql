-- Restore manager access for child team managers in parent teams
-- This restores RLS access to sibling teams via get_manager_accessible_teams()
-- UI will handle filtering display and edit permissions

-- Turbine Operations Central
-- Restore manager flag for EV, TOSTU, HEKOT (needed for RLS access to sibling teams)
UPDATE team_members
SET is_manager = true
WHERE team_id = '03f35821-d6b4-4bbe-81d8-318abf61072c' -- Turbine Operations Central
  AND user_id IN (
    '7f679efb-dfc1-491a-af33-e42c0529c5ce',  -- EV (Troubleshooting East)
    '74377a40-2ac8-4d03-9199-b24eb35ac17c',  -- TOSTU (Troubleshooting North/West)
    'a2822009-99a8-4747-8cbc-188d1138f8a0'   -- HEKOT (Troubleshooting South)
  );

-- Turbine Operations North
-- Restore manager flag for HADJO, JEBOG, STPKO (needed for RLS access to sibling teams)
UPDATE team_members
SET is_manager = true
WHERE team_id = '40df8223-5d71-4bc1-8fd6-620a2a407bb6' -- Turbine Operations North
  AND user_id IN (
    '98c226ca-46ac-4a0e-a5ca-c37553edbe31',  -- HADJO (Troubleshooting Central)
    '70e5f06a-0032-4454-9dc3-e70d37566e27',  -- JEBOG (Troubleshooting West)
    '44f7c1c2-f46d-4226-b60f-5c96c815e7ae'   -- STPKO (Troubleshooting East)
  );

-- Turbine Operations Offshore
-- Restore manager flag for MAVAC (needed for RLS access to sibling teams)
UPDATE team_members
SET is_manager = true
WHERE team_id = '51eb89b1-c9cb-415d-a7f3-ec6332fb6f6c' -- Turbine Operations Offshore
  AND user_id IN (
    '9ebe1ce1-8058-4ef3-9439-60523d9c59c6'   -- MAVAC (Troubleshooting Offshore)
  );