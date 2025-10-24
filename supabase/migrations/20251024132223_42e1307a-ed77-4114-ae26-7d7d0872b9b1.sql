-- Add sub-team managers as members to parent team (Turbine Operations North)
-- This makes their schedules visible in PGM's team view
INSERT INTO team_members (team_id, user_id, is_manager)
SELECT 
  '40df8223-5d71-4bc1-8fd6-620a2a407bb6'::uuid, -- Turbine Operations North
  tm.user_id,
  false -- They are team members, not managers, of the parent team
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE t.parent_team_id = '40df8223-5d71-4bc1-8fd6-620a2a407bb6'
  AND tm.is_manager = true
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Update user roles for hierarchical structure
-- Change role from 'manager' to 'teammember' for managers of child teams
-- This creates organizational hierarchy while preserving team management capabilities
UPDATE user_roles ur
SET role = 'teammember'
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
WHERE ur.user_id = tm.user_id
  AND ur.role = 'manager'
  AND tm.is_manager = true
  AND t.parent_team_id IS NOT NULL;