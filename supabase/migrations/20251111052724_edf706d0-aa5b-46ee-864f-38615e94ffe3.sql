-- Remove HEKOT's manager assignment from parent team Turbine Operations Central
-- HEKOT should only be manager of the South team, not the parent team
-- This will restrict his edit access to only the South team and its descendants

DELETE FROM team_members 
WHERE user_id = 'a2822009-99a8-4747-8cbc-188d1138f8a0'  -- HEKOT's user_id
  AND team_id = '03f35821-d6b4-4bbe-81d8-318abf61072c'  -- Turbine Operations Central parent team
  AND is_manager = true;