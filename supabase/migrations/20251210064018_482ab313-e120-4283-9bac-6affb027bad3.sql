-- Create country_shift_limits table for tracking per-country shift regulations
CREATE TABLE public.country_shift_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  max_shifts_per_year INTEGER NOT NULL,
  year INTEGER NOT NULL,
  partnership_id UUID REFERENCES public.team_planning_partners(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create unique index that handles null partnership_id
CREATE UNIQUE INDEX idx_country_shift_limits_unique 
ON public.country_shift_limits(country_code, shift_type, year, COALESCE(partnership_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable RLS
ALTER TABLE public.country_shift_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins and planners can manage all country shift limits"
ON public.country_shift_limits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Managers can view country shift limits for their partnerships"
ON public.country_shift_limits FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND (
    partnership_id IS NULL OR
    EXISTS (
      SELECT 1 FROM team_planning_partners tpp
      WHERE tpp.id = country_shift_limits.partnership_id
      AND EXISTS (
        SELECT 1 FROM unnest(tpp.team_ids) team_id
        WHERE team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
      )
    )
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_country_shift_limits_updated_at
  BEFORE UPDATE ON public.country_shift_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_country_shift_limits_lookup 
ON public.country_shift_limits(country_code, shift_type, year);

CREATE INDEX idx_country_shift_limits_partnership 
ON public.country_shift_limits(partnership_id) WHERE partnership_id IS NOT NULL;