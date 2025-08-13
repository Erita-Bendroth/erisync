-- Update RLS policies for schedule_entries to fix the "Failed to load schedule entries" error
-- Add a policy that allows planners and managers to view all schedule entries

-- Drop existing restrictive policies that might be preventing access
DROP POLICY IF EXISTS "Managers can view other teams availability only" ON schedule_entries;

-- Add comprehensive policy for planners to see all entries
CREATE POLICY "Planners can view all entries comprehensive" 
ON schedule_entries 
FOR SELECT 
TO authenticated
USING (
  -- Allow if user is a planner (should see everything)
  has_role(auth.uid(), 'planner'::app_role) OR
  -- Allow if user is a manager of this team
  (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of_team(auth.uid(), team_id)) OR
  -- Allow if user is viewing their own entries
  (auth.uid() = user_id)
);