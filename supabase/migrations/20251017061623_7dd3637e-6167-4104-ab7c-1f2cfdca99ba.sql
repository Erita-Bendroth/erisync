-- Create table for team view favorites
CREATE TABLE public.team_view_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  team_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_favorite_name UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.team_view_favorites ENABLE ROW LEVEL SECURITY;

-- Users can manage their own favorites
CREATE POLICY "Users can manage their own favorites"
ON public.team_view_favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins and planners can view all favorites
CREATE POLICY "Admins and planners can view all favorites"
ON public.team_view_favorites
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planner'::app_role)
);

-- Add updated_at trigger
CREATE TRIGGER update_team_view_favorites_updated_at
BEFORE UPDATE ON public.team_view_favorites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_team_view_favorites_user_id ON public.team_view_favorites(user_id);