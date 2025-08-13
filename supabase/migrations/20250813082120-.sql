-- Remove any existing policies that might allow non-planners/managers to modify schedule entries
DROP POLICY IF EXISTS "Users can insert their own entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Team members can manage their own entries" ON public.schedule_entries;

-- Ensure only planners and managers can INSERT schedule entries
-- (The existing policies already handle this correctly, but let's be explicit)

-- Create a specific policy for planners to insert any schedule entry
CREATE POLICY "Only planners can insert schedule entries" 
ON public.schedule_entries 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'planner'::app_role));

-- Create a specific policy for managers to insert entries for their teams only
CREATE POLICY "Only managers can insert entries for their teams" 
ON public.schedule_entries 
FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) 
    AND is_manager_of_team(auth.uid(), team_id)
);

-- Create a specific policy for planners to update any schedule entry
CREATE POLICY "Only planners can update schedule entries" 
ON public.schedule_entries 
FOR UPDATE 
USING (has_role(auth.uid(), 'planner'::app_role));

-- Create a specific policy for managers to update entries for their teams only
CREATE POLICY "Only managers can update entries for their teams" 
ON public.schedule_entries 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND is_manager_of_team(auth.uid(), team_id)
);

-- Create a specific policy for planners to delete any schedule entry
CREATE POLICY "Only planners can delete schedule entries" 
ON public.schedule_entries 
FOR DELETE 
USING (has_role(auth.uid(), 'planner'::app_role));

-- Create a specific policy for managers to delete entries for their teams only
CREATE POLICY "Only managers can delete entries for their teams" 
ON public.schedule_entries 
FOR DELETE 
USING (
    has_role(auth.uid(), 'manager'::app_role) 
    AND is_manager_of_team(auth.uid(), team_id)
);

-- Update the existing broad policies to be more specific
-- Remove the broad "Managers can manage their team entries" policy and replace with specific ones
DROP POLICY IF EXISTS "Managers can manage their team entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Planners can manage all schedule entries" ON public.schedule_entries;