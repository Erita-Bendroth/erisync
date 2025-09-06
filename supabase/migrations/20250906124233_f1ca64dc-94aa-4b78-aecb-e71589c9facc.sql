-- Create secure server-side token storage for OAuth integrations
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'outlook', 'google', etc.
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    token_type TEXT DEFAULT 'Bearer',
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider)
);

-- Enable RLS on OAuth tokens table
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only access their own tokens
CREATE POLICY "Users can manage their own OAuth tokens" 
ON public.user_oauth_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all tokens for support purposes
CREATE POLICY "Admins can view all OAuth tokens" 
ON public.user_oauth_tokens 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update audit log policies to restrict to admin/planner only
DROP POLICY IF EXISTS "Planners and managers can view cron logs" ON public.cron_job_logs;
CREATE POLICY "Only admins and planners can view cron logs" 
ON public.cron_job_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

-- Restrict profile access logs to admin/planner only
DROP POLICY IF EXISTS "Managers can view access logs for their team members only" ON public.profile_access_log;
CREATE POLICY "Only admins and planners can view profile access logs" 
ON public.profile_access_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

-- Add trigger for token table updates
CREATE TRIGGER update_user_oauth_tokens_updated_at
BEFORE UPDATE ON public.user_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();