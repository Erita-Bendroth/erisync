-- Create home_office_limits table for country-specific HO rules
CREATE TABLE public.home_office_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('weekly', 'monthly', 'yearly')),
  max_days INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.home_office_limits ENABLE ROW LEVEL SECURITY;

-- Everyone can view HO limits
CREATE POLICY "Authenticated users can view HO limits"
ON public.home_office_limits
FOR SELECT
TO authenticated
USING (true);

-- Only admins/planners can manage limits
CREATE POLICY "Admins and planners can manage HO limits"
ON public.home_office_limits
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

-- Insert default limits for common countries
INSERT INTO public.home_office_limits (country_code, limit_type, max_days, notes) VALUES
  ('SE', 'weekly', 2, 'Sweden: Max 2 days per week'),
  ('DE', 'monthly', 10, 'Germany: Max 10 days per month'),
  ('US', 'yearly', 52, 'US: Flexible policy - max 52 days per year'),
  ('PL', 'monthly', 8, 'Poland: Max 8 days per month'),
  ('BE', 'weekly', 3, 'Belgium: Max 3 days per week');