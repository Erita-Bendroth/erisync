-- Step 1: Add GESCH as manager to Turbine Operations Central
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES 
  ('03f35821-d6b4-4bbe-81d8-318abf61072c', '4b6c277c-fec9-4a1f-95ca-f2baa604cf0d', true)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Step 2: Add all sub-team managers as non-manager members to their parent teams
-- This creates schedule visibility up the management chain without changing management capabilities
INSERT INTO team_members (team_id, user_id, is_manager)
SELECT 
  t.parent_team_id,
  tm.user_id,
  false
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE tm.is_manager = true
  AND t.parent_team_id IS NOT NULL
  AND t.parent_team_id IN (
    '03f35821-d6b4-4bbe-81d8-318abf61072c', -- Turbine Operations Central
    '51eb89b1-c9cb-415d-a7f3-ec6332fb6f6c', -- Turbine Operations Offshore
    'bae51915-a857-4716-aba5-a1f5a2800369', -- Plant Operations Central
    'ee0724a4-eb62-4a4a-83cb-34025c378061', -- Plant Operations North
    'bd7cb258-41bb-4ca0-8575-4acbac64e649', -- Plant Operations Offshore
    '40df8223-5d71-4bc1-8fd6-620a2a407bb6'  -- Turbine Operations North
  )
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Step 3: Update user roles for organizational hierarchy
-- Change role from 'manager' to 'teammember' for all managers of child teams
-- CRITICAL: Keep 'manager' role ONLY for GESCH and SABUN (top-level managers)
UPDATE user_roles ur
SET role = 'teammember'
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE ur.user_id = tm.user_id
  AND ur.role = 'manager'
  AND tm.is_manager = true
  AND t.parent_team_id IS NOT NULL
  AND ur.user_id NOT IN (
    '4b6c277c-fec9-4a1f-95ca-f2baa604cf0d', -- GESCH
    'd3efa1fe-d8b1-436a-ba16-4164f33b1a5b'  -- SABUN
  );

-- Step 4: Update KOPIJ's profile to set initials
UPDATE profiles 
SET initials = 'KOPIJ' 
WHERE user_id = '36c08bab-da0f-4e19-8232-96b8240f8be1';