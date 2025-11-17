-- Phase 1: Shift Swap Feature Database Schema

-- 1.1 Create shift_swap_status enum
CREATE TYPE shift_swap_status AS ENUM (
  'pending',
  'approved', 
  'rejected',
  'cancelled',
  'expired'
);

-- 1.2 Create shift_swap_requests table
CREATE TABLE shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Requesting user info
  requesting_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  requesting_entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  
  -- Target user info
  target_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_entry_id UUID NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  
  -- Swap details
  swap_date DATE NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status shift_swap_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  
  -- Approval tracking
  reviewed_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT different_users CHECK (requesting_user_id != target_user_id),
  CONSTRAINT valid_review CHECK (
    (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR
    (status NOT IN ('approved', 'rejected'))
  )
);

-- Create indexes for performance
CREATE INDEX idx_swap_requests_requesting_user ON shift_swap_requests(requesting_user_id);
CREATE INDEX idx_swap_requests_target_user ON shift_swap_requests(target_user_id);
CREATE INDEX idx_swap_requests_team ON shift_swap_requests(team_id);
CREATE INDEX idx_swap_requests_status ON shift_swap_requests(status);
CREATE INDEX idx_swap_requests_date ON shift_swap_requests(swap_date);

-- Enable RLS
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE TRIGGER update_shift_swap_requests_updated_at
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- Team members can view swap requests they're involved in
CREATE POLICY "Team members view their swap requests"
  ON shift_swap_requests FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      requesting_user_id = auth.uid() OR
      target_user_id = auth.uid()
    )
  );

-- Team members can create swap requests for their own shifts
CREATE POLICY "Team members create swap requests"
  ON shift_swap_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requesting_user_id AND
    team_id IN (SELECT get_user_teams(auth.uid()))
  );

-- Team members can cancel their own pending requests
CREATE POLICY "Team members cancel own pending requests"
  ON shift_swap_requests FOR UPDATE
  USING (
    auth.uid() = requesting_user_id AND
    status = 'pending'
  )
  WITH CHECK (
    auth.uid() = requesting_user_id AND
    status = 'cancelled'
  );

-- Managers can view all swap requests for their accessible teams
CREATE POLICY "Managers view team swap requests"
  ON shift_swap_requests FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  );

-- Managers can approve/reject swap requests for their teams
CREATE POLICY "Managers approve reject swap requests"
  ON shift_swap_requests FOR UPDATE
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND
    team_id IN (SELECT get_manager_accessible_teams(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'manager'::app_role) AND
    team_id IN (SELECT get_manager_accessible_teams(auth.uid())) AND
    reviewed_by = auth.uid()
  );

-- Admins and planners can manage all swap requests
CREATE POLICY "Admins planners manage all swap requests"
  ON shift_swap_requests FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role)
  );