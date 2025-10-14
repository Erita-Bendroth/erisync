-- Create manager_delegations table
CREATE TABLE public.manager_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL,
  delegate_id UUID NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID,
  CONSTRAINT different_users CHECK (manager_id != delegate_id),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create index for efficient lookups
CREATE INDEX idx_delegations_delegate_active ON public.manager_delegations(delegate_id, status) 
  WHERE status = 'active';
CREATE INDEX idx_delegations_manager ON public.manager_delegations(manager_id);
CREATE INDEX idx_delegations_dates ON public.manager_delegations(start_date, end_date);

-- Enable RLS
ALTER TABLE public.manager_delegations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manager_delegations
CREATE POLICY "Managers can view their own delegations"
  ON public.manager_delegations
  FOR SELECT
  USING (
    auth.uid() = manager_id OR 
    auth.uid() = delegate_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'planner'::app_role)
  );

CREATE POLICY "Managers can create delegations"
  ON public.manager_delegations
  FOR INSERT
  WITH CHECK (
    auth.uid() = manager_id AND 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Managers can update their own delegations"
  ON public.manager_delegations
  FOR UPDATE
  USING (auth.uid() = manager_id)
  WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "Admins can manage all delegations"
  ON public.manager_delegations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to check if user is a valid active delegate
CREATE OR REPLACE FUNCTION public.is_active_delegate(_delegate_id uuid, _manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manager_delegations
    WHERE delegate_id = _delegate_id
      AND manager_id = _manager_id
      AND status = 'active'
      AND now() BETWEEN start_date AND end_date
  );
$$;

-- Function to get all managers a user is delegating for
CREATE OR REPLACE FUNCTION public.get_delegated_manager_teams(_delegate_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT tm.team_id
  FROM public.manager_delegations md
  INNER JOIN public.team_members tm ON md.manager_id = tm.user_id
  WHERE md.delegate_id = _delegate_id
    AND md.status = 'active'
    AND now() BETWEEN md.start_date AND md.end_date
    AND tm.is_manager = true;
$$;

-- Function to check if user has manager access (either as manager or delegate)
CREATE OR REPLACE FUNCTION public.has_manager_access(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Direct manager access
    is_manager_of_team(_user_id, _team_id) 
    OR 
    -- Delegated access
    EXISTS (
      SELECT 1
      FROM public.manager_delegations md
      INNER JOIN public.team_members tm ON md.manager_id = tm.user_id
      WHERE md.delegate_id = _user_id
        AND md.status = 'active'
        AND now() BETWEEN md.start_date AND md.end_date
        AND tm.team_id = _team_id
        AND tm.is_manager = true
    )
  );
$$;

-- Function to auto-expire delegations
CREATE OR REPLACE FUNCTION public.expire_old_delegations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.manager_delegations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND end_date < now();
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_manager_delegations_updated_at
  BEFORE UPDATE ON public.manager_delegations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create delegation audit log table
CREATE TABLE public.delegation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES public.manager_delegations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'revoked', 'expired', 'accessed')),
  performed_by UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_delegation_audit_delegation ON public.delegation_audit_log(delegation_id);
CREATE INDEX idx_delegation_audit_created ON public.delegation_audit_log(created_at);

ALTER TABLE public.delegation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and planners can view delegation audit logs"
  ON public.delegation_audit_log
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planner'::app_role)
  );

CREATE POLICY "System can insert delegation audit logs"
  ON public.delegation_audit_log
  FOR INSERT
  WITH CHECK (true);