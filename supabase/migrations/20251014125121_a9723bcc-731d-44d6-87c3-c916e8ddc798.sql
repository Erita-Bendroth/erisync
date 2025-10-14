-- Create team audit log table
CREATE TABLE public.team_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_team_audit_log_team_id ON public.team_audit_log(team_id);
CREATE INDEX idx_team_audit_log_created_at ON public.team_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.team_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and planners can view audit logs
CREATE POLICY "Admins and planners can view team audit logs"
  ON public.team_audit_log
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  );

-- System can insert audit logs (SECURITY DEFINER functions will handle this)
CREATE POLICY "System can insert audit logs"
  ON public.team_audit_log
  FOR INSERT
  WITH CHECK (true);