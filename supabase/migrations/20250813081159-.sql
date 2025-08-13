-- Add country column to profiles for holiday detection
ALTER TABLE public.profiles 
ADD COLUMN country_code TEXT DEFAULT 'US';

-- Create holidays table to store public holidays
CREATE TABLE public.holidays (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    country_code TEXT NOT NULL,
    year INTEGER NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(date, country_code)
);

-- Enable RLS on holidays table
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view holidays
CREATE POLICY "Users can view holidays" 
ON public.holidays 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only planners can manage holidays
CREATE POLICY "Planners can manage holidays" 
ON public.holidays 
FOR ALL 
USING (has_role(auth.uid(), 'planner'::app_role));

-- Add trigger for updating timestamps
CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to import holidays for a country and year
CREATE OR REPLACE FUNCTION public.import_holidays_for_year(
    _country_code TEXT,
    _year INTEGER
) RETURNS VOID AS $$
BEGIN
    -- This will be called by the edge function
    -- Just a placeholder for now
    RAISE NOTICE 'Holiday import function called for % in %', _country_code, _year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;