-- Add GESCH as manager of Turbine Operations Central
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '03f35821-d6b4-4bbe-81d8-318abf61072c',
  '4b6c277c-fec9-4a1f-95ca-f2baa604cf0d',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Add JEBOG as manager of Turbine Operations North
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '40df8223-5d71-4bc1-8fd6-620a2a407bb6',
  '70e5f06a-0032-4454-9dc3-e70d37566e27',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Add HADJO as manager of Turbine Operations North
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '40df8223-5d71-4bc1-8fd6-620a2a407bb6',
  '98c226ca-46ac-4a0e-a5ca-c37553edbe31',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;

-- Add STPKO as manager of Turbine Operations North
INSERT INTO team_members (team_id, user_id, is_manager)
VALUES (
  '40df8223-5d71-4bc1-8fd6-620a2a407bb6',
  '44f7c1c2-f46d-4226-b60f-5c96c815e7ae',
  true
)
ON CONFLICT (team_id, user_id) DO UPDATE SET is_manager = true;