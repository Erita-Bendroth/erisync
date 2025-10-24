-- Create shift_time_definitions table for customizable shift times
CREATE TABLE public.shift_time_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  region_code TEXT,
  shift_type shift_type NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, region_code, shift_type, day_of_week)
);

-- Enable RLS
ALTER TABLE public.shift_time_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_time_definitions
CREATE POLICY "Admins can manage all shift time definitions"
ON public.shift_time_definitions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can manage all shift time definitions"
ON public.shift_time_definitions
FOR ALL
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can manage their team shift time definitions"
ON public.shift_time_definitions
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (team_id IS NULL OR team_id IN (SELECT get_manager_accessible_teams(auth.uid())))
);

CREATE POLICY "Authenticated users can view shift time definitions"
ON public.shift_time_definitions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create team_groups table for grouping teams
CREATE TABLE public.team_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_ids UUID[] NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_groups
CREATE POLICY "Admins can manage all team groups"
ON public.team_groups
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Planners can manage all team groups"
ON public.team_groups
FOR ALL
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can manage team groups for their teams"
ON public.team_groups
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM unnest(team_ids) AS tid
    WHERE tid IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

CREATE POLICY "Authenticated users can view team groups"
ON public.team_groups
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_shift_time_definitions_updated_at
BEFORE UPDATE ON public.shift_time_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_groups_updated_at
BEFORE UPDATE ON public.team_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default shift time definitions (global defaults)
INSERT INTO public.shift_time_definitions (shift_type, start_time, end_time, description, created_by)
VALUES
  ('normal', '08:00', '16:30', 'Normal shift (default)', (SELECT id FROM auth.users LIMIT 1)),
  ('early', '06:00', '14:00', 'Early shift (default)', (SELECT id FROM auth.users LIMIT 1)),
  ('late', '14:00', '22:00', 'Late shift (default)', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;