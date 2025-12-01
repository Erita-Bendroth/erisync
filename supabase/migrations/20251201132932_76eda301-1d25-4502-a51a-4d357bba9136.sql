-- Create RPC function to get all members from partnership teams
-- This bypasses RLS restrictions for managers viewing partnership rosters
CREATE OR REPLACE FUNCTION get_partnership_team_members(p_partnership_id UUID)
RETURNS TABLE (
  user_id UUID,
  team_id UUID,
  team_name TEXT,
  first_name TEXT,
  last_name TEXT,
  initials TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.user_id,
    tm.team_id,
    t.name as team_name,
    p.first_name,
    p.last_name,
    p.initials
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  JOIN profiles p ON p.user_id = tm.user_id
  WHERE tm.team_id IN (
    SELECT unnest(team_ids)
    FROM team_planning_partners
    WHERE id = p_partnership_id
  )
  ORDER BY t.name, p.first_name, p.last_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_partnership_team_members(UUID) TO authenticated;