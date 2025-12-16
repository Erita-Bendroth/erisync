-- Create daily_time_entries table for German FlexTime recording
CREATE TABLE public.daily_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  work_start_time TIME,
  work_end_time TIME,
  break_duration_minutes INTEGER DEFAULT 30,
  target_hours NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  actual_hours_worked NUMERIC(5,2),
  flextime_delta NUMERIC(5,2),
  entry_type TEXT DEFAULT 'work', -- work, home_office, sick_leave, team_meeting, training, vacation, public_holiday
  comment TEXT,
  schedule_entry_id UUID REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Create monthly_flextime_summary table for tracking monthly balances
CREATE TABLE public.monthly_flextime_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  starting_balance NUMERIC(6,2) DEFAULT 0,
  month_delta NUMERIC(6,2) DEFAULT 0,
  ending_balance NUMERIC(6,2) DEFAULT 0,
  is_finalized BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- Enable RLS on both tables
ALTER TABLE public.daily_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_flextime_summary ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_time_entries
CREATE POLICY "Users can manage their own time entries"
ON public.daily_time_entries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view team member time entries"
ON public.daily_time_entries
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  user_id IN (
    SELECT tm.user_id 
    FROM team_members tm 
    WHERE tm.team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

CREATE POLICY "Planners can view all time entries"
ON public.daily_time_entries
FOR SELECT
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Admins can manage all time entries"
ON public.daily_time_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for monthly_flextime_summary
CREATE POLICY "Users can manage their own flextime summary"
ON public.monthly_flextime_summary
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view team member flextime summary"
ON public.monthly_flextime_summary
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  user_id IN (
    SELECT tm.user_id 
    FROM team_members tm 
    WHERE tm.team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
);

CREATE POLICY "Planners can view all flextime summaries"
ON public.monthly_flextime_summary
FOR SELECT
USING (has_role(auth.uid(), 'planner'::app_role));

CREATE POLICY "Admins can manage all flextime summaries"
ON public.monthly_flextime_summary
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_daily_time_entries_user_date ON public.daily_time_entries(user_id, entry_date);
CREATE INDEX idx_daily_time_entries_date ON public.daily_time_entries(entry_date);
CREATE INDEX idx_monthly_flextime_summary_user ON public.monthly_flextime_summary(user_id, year, month);