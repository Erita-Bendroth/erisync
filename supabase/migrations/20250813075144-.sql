-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('manager', 'planner', 'teammember');

-- Create enum for shift types
CREATE TYPE public.shift_type AS ENUM ('early', 'late', 'normal');

-- Create enum for activity types
CREATE TYPE public.activity_type AS ENUM ('work', 'vacation', 'sick', 'hotline_support');

-- Create enum for availability status
CREATE TYPE public.availability_status AS ENUM ('available', 'unavailable');

-- Create teams table
CREATE TABLE public.teams (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create team_members table to link users to teams
CREATE TABLE public.team_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    is_manager BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, team_id)
);

-- Create schedule_entries table for all scheduling data
CREATE TABLE public.schedule_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_type shift_type DEFAULT 'normal',
    activity_type activity_type NOT NULL DEFAULT 'work',
    availability_status availability_status NOT NULL DEFAULT 'available',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of_team(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE user_id = _user_id AND team_id = _team_id AND is_manager = true
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_teams(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for teams
CREATE POLICY "All authenticated users can view teams" ON public.teams
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only planners can create teams" ON public.teams
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Only planners can update teams" ON public.teams
    FOR UPDATE USING (public.has_role(auth.uid(), 'planner'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles" ON public.user_roles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only planners can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'planner'));

-- RLS Policies for team_members
CREATE POLICY "Users can view team memberships" ON public.team_members
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only planners can manage team memberships" ON public.team_members
    FOR ALL USING (public.has_role(auth.uid(), 'planner'));

-- RLS Policies for schedule_entries (complex based on roles)
-- Planners can see everything
CREATE POLICY "Planners can view all schedule entries" ON public.schedule_entries
    FOR SELECT USING (public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Planners can manage all schedule entries" ON public.schedule_entries
    FOR ALL USING (public.has_role(auth.uid(), 'planner'));

-- Managers can see full details of their team, availability only of other teams
CREATE POLICY "Managers can view their team entries" ON public.schedule_entries
    FOR SELECT USING (
        public.has_role(auth.uid(), 'manager') AND 
        public.is_manager_of_team(auth.uid(), team_id)
    );

CREATE POLICY "Managers can view other teams availability only" ON public.schedule_entries
    FOR SELECT USING (
        public.has_role(auth.uid(), 'manager') AND 
        NOT public.is_manager_of_team(auth.uid(), team_id)
    );

CREATE POLICY "Managers can manage their team entries" ON public.schedule_entries
    FOR ALL USING (
        public.has_role(auth.uid(), 'manager') AND 
        public.is_manager_of_team(auth.uid(), team_id)
    );

-- Team members can only see availability status across all teams
CREATE POLICY "Team members can view availability only" ON public.schedule_entries
    FOR SELECT USING (public.has_role(auth.uid(), 'teammember'));

-- Users can view their own entries
CREATE POLICY "Users can view their own entries" ON public.schedule_entries
    FOR SELECT USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_entries_updated_at
    BEFORE UPDATE ON public.schedule_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();