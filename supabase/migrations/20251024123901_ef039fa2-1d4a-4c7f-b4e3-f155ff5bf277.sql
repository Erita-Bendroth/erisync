-- Drop all RLS policies that depend on team_id before dropping the column
DROP POLICY IF EXISTS "Admins can manage all templates" ON public.weekly_duty_templates;
DROP POLICY IF EXISTS "Managers can manage templates for their teams" ON public.weekly_duty_templates;
DROP POLICY IF EXISTS "Planners can manage all templates" ON public.weekly_duty_templates;
DROP POLICY IF EXISTS "Managers can view email history for their teams" ON public.weekly_email_history;

-- Change team_id to team_ids array in weekly_duty_templates
ALTER TABLE public.weekly_duty_templates ADD COLUMN team_ids uuid[];

-- Migrate existing data from team_id to team_ids array
UPDATE public.weekly_duty_templates SET team_ids = ARRAY[team_id] WHERE team_id IS NOT NULL;

-- Make team_ids NOT NULL now that data is migrated
ALTER TABLE public.weekly_duty_templates ALTER COLUMN team_ids SET NOT NULL;

-- Drop old team_id column
ALTER TABLE public.weekly_duty_templates DROP COLUMN team_id CASCADE;

-- Create updated RLS policies for team_ids array on weekly_duty_templates
CREATE POLICY "Admins can manage all templates"
ON public.weekly_duty_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can manage all templates"
ON public.weekly_duty_templates
FOR ALL
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can manage templates for their teams"
ON public.weekly_duty_templates
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

-- Recreate the policy for weekly_email_history with updated team_ids reference
CREATE POLICY "Managers can view email history for their teams"
ON public.weekly_email_history
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  template_id IN (
    SELECT id FROM public.weekly_duty_templates wdt
    WHERE EXISTS (
      SELECT 1 FROM unnest(wdt.team_ids) AS tid
      WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
    )
  )
);