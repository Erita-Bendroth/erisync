-- Update the user to be a manager of their team
UPDATE team_members 
SET is_manager = true 
WHERE user_id = (SELECT user_id FROM profiles WHERE email = 'erita@bendroth.se');