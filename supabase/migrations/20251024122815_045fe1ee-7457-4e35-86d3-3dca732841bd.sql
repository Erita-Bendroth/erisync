-- Create enum for duty types
CREATE TYPE duty_type AS ENUM ('weekend', 'lateshift', 'earlyshift');

-- Create weekly_duty_templates table
CREATE TABLE public.weekly_duty_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  distribution_list TEXT[] NOT NULL DEFAULT '{}',
  include_weekend_duty BOOLEAN NOT NULL DEFAULT true,
  include_lateshift BOOLEAN NOT NULL DEFAULT false,
  include_earlyshift BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create duty_assignments table
CREATE TABLE public.duty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  substitute_user_id UUID,
  duty_type duty_type NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_week CHECK (week_number BETWEEN 1 AND 53),
  CONSTRAINT valid_year CHECK (year BETWEEN 2020 AND 2100)
);

-- Create weekly_email_history table
CREATE TABLE public.weekly_email_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.weekly_duty_templates(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed'))
);

-- Enable RLS
ALTER TABLE public.weekly_duty_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_email_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_duty_templates
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
    team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  );

-- RLS Policies for duty_assignments
CREATE POLICY "Admins can manage all assignments"
  ON public.duty_assignments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can manage all assignments"
  ON public.duty_assignments
  FOR ALL
  USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can manage assignments for their teams"
  ON public.duty_assignments
  FOR ALL
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  );

-- RLS Policies for weekly_email_history
CREATE POLICY "Admins can view all email history"
  ON public.weekly_email_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can view all email history"
  ON public.weekly_email_history
  FOR SELECT
  USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can view email history for their teams"
  ON public.weekly_email_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    template_id IN (
      SELECT id FROM public.weekly_duty_templates
      WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
    )
  );

-- Create indexes for performance
CREATE INDEX idx_duty_assignments_team_week ON public.duty_assignments(team_id, year, week_number);
CREATE INDEX idx_duty_assignments_date ON public.duty_assignments(date);
CREATE INDEX idx_weekly_duty_templates_team ON public.weekly_duty_templates(team_id);
CREATE INDEX idx_weekly_email_history_template ON public.weekly_email_history(template_id);

-- Create updated_at trigger
CREATE TRIGGER update_weekly_duty_templates_updated_at
  BEFORE UPDATE ON public.weekly_duty_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_duty_assignments_updated_at
  BEFORE UPDATE ON public.duty_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();