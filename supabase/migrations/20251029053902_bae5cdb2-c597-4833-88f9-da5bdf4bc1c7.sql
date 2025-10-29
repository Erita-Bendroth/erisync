-- Create custom duty email templates table
CREATE TABLE IF NOT EXISTS public.custom_duty_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  template_data JSONB NOT NULL,
  distribution_list TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.custom_duty_email_templates ENABLE ROW LEVEL SECURITY;

-- Allow managers/planners/admins to manage custom email templates
CREATE POLICY "Managers can manage custom email templates"
ON public.custom_duty_email_templates
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'planner'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_duty_templates_week 
ON public.custom_duty_email_templates(week_number, year);

CREATE INDEX IF NOT EXISTS idx_custom_duty_templates_creator 
ON public.custom_duty_email_templates(created_by);

-- Add updated_at trigger
CREATE TRIGGER update_custom_duty_email_templates_updated_at
  BEFORE UPDATE ON public.custom_duty_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();