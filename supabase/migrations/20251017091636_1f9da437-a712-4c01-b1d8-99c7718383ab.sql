-- Create table to track holiday import status
CREATE TABLE IF NOT EXISTS public.holiday_import_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  region_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  imported_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(country_code, year, region_code)
);

-- Enable RLS
ALTER TABLE public.holiday_import_status ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and planners can view import status
CREATE POLICY "Admins and planners can view import status"
  ON public.holiday_import_status
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'planner'::app_role)
    )
  );

-- Policy: Only admins and planners can insert import status
CREATE POLICY "Admins and planners can insert import status"
  ON public.holiday_import_status
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'planner'::app_role)
    )
  );

-- Policy: Only admins and planners can update import status
CREATE POLICY "Admins and planners can update import status"
  ON public.holiday_import_status
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'planner'::app_role)
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_holiday_import_status_lookup ON public.holiday_import_status(country_code, year, region_code);
CREATE INDEX idx_holiday_import_status_status ON public.holiday_import_status(status);

-- Add updated_at column and trigger
ALTER TABLE public.holiday_import_status ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE TRIGGER update_holiday_import_status_updated_at
  BEFORE UPDATE ON public.holiday_import_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();