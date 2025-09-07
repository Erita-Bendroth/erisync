-- Fix manager access to bulk schedule creation by updating RLS policy
-- The issue is that managers need to create schedule entries for team members, 
-- but the current policy only allows managers to create entries for teams they manage,
-- not for other users in those teams.

-- Drop the problematic manager insert policy
DROP POLICY IF EXISTS "Only managers can insert entries for their teams" ON public.schedule_entries;

-- Create a new policy that allows managers to insert entries for their team members
CREATE POLICY "Managers can insert entries for their team members" 
ON public.schedule_entries 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND 
  (
    -- Managers can create entries for themselves
    auth.uid() = user_id OR
    -- Managers can create entries for users in teams they manage
    EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = schedule_entries.user_id
      AND tm1.team_id = schedule_entries.team_id
    )
  )
);

-- Also update the update policy to match
DROP POLICY IF EXISTS "Only managers can update entries for their teams" ON public.schedule_entries;

CREATE POLICY "Managers can update entries for their team members" 
ON public.schedule_entries 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  (
    -- Managers can update entries for themselves
    auth.uid() = user_id OR
    -- Managers can update entries for users in teams they manage
    EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = schedule_entries.user_id
      AND tm1.team_id = schedule_entries.team_id
    )
  )
);

-- Update delete policy to match as well
DROP POLICY IF EXISTS "Only managers can delete entries for their teams" ON public.schedule_entries;

CREATE POLICY "Managers can delete entries for their team members" 
ON public.schedule_entries 
FOR DELETE 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  (
    -- Managers can delete entries for themselves
    auth.uid() = user_id OR
    -- Managers can delete entries for users in teams they manage
    EXISTS (
      SELECT 1 FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm1.is_manager = true
      AND tm2.user_id = schedule_entries.user_id
      AND tm1.team_id = schedule_entries.team_id
    )
  )
);