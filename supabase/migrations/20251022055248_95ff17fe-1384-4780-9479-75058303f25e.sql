-- Create search history table
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  search_type TEXT NOT NULL, -- 'user', 'team', 'schedule', 'global'
  result_count INTEGER,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, searched_at DESC);

-- Create schedule bookmarks table
CREATE TABLE IF NOT EXISTS schedule_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bookmark_type TEXT NOT NULL, -- 'date_range', 'user_schedule', 'team_schedule'
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_schedule_bookmarks_user ON schedule_bookmarks(user_id, created_at DESC);

-- Create user favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, favorite_user_id),
  CHECK(user_id != favorite_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id, created_at DESC);

-- Global search function
CREATE OR REPLACE FUNCTION global_search(
  _search_query TEXT,
  _current_user_id UUID,
  _limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_users JSONB;
  v_teams JSONB;
  v_schedules JSONB;
  v_is_admin BOOLEAN;
  v_is_planner BOOLEAN;
  v_is_manager BOOLEAN;
BEGIN
  -- Get user's roles
  SELECT 
    bool_or(role = 'admin'),
    bool_or(role = 'planner'),
    bool_or(role = 'manager')
  INTO v_is_admin, v_is_planner, v_is_manager
  FROM public.user_roles
  WHERE user_id = _current_user_id;
  
  -- Search users
  IF v_is_admin OR v_is_planner THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.user_id,
        'name', p.first_name || ' ' || p.last_name,
        'email', p.email,
        'type', 'user'
      )
    ) INTO v_users
    FROM profiles p
    WHERE (p.first_name || ' ' || p.last_name) ILIKE '%' || _search_query || '%'
       OR p.email ILIKE '%' || _search_query || '%'
    LIMIT _limit;
  ELSIF v_is_manager THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.user_id,
        'name', p.first_name || ' ' || p.last_name,
        'type', 'user'
      )
    ) INTO v_users
    FROM profiles p
    JOIN team_members tm ON tm.user_id = p.user_id
    WHERE tm.team_id IN (SELECT get_manager_accessible_teams(_current_user_id))
      AND (p.first_name || ' ' || p.last_name) ILIKE '%' || _search_query || '%'
    LIMIT _limit;
  END IF;
  
  -- Search teams
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'member_count', (SELECT COUNT(*) FROM team_members WHERE team_id = t.id),
      'type', 'team'
    )
  ) INTO v_teams
  FROM teams t
  WHERE t.name ILIKE '%' || _search_query || '%'
     OR COALESCE(t.description, '') ILIKE '%' || _search_query || '%'
  LIMIT _limit;
  
  -- Search schedule entries
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'user_name', p.first_name || ' ' || p.last_name,
      'team_name', t.name,
      'team_id', t.id,
      'date', se.date,
      'activity', se.activity_type,
      'shift', se.shift_type,
      'type', 'schedule'
    )
  ) INTO v_schedules
  FROM schedule_entries se
  JOIN profiles p ON p.user_id = se.user_id
  JOIN teams t ON t.id = se.team_id
  WHERE se.date >= CURRENT_DATE - INTERVAL '90 days'
    AND se.date <= CURRENT_DATE + INTERVAL '90 days'
    AND (
      (p.first_name || ' ' || p.last_name) ILIKE '%' || _search_query || '%'
      OR t.name ILIKE '%' || _search_query || '%'
      OR COALESCE(se.notes, '') ILIKE '%' || _search_query || '%'
    )
  LIMIT _limit;
  
  -- Build result
  v_result := jsonb_build_object(
    'users', COALESCE(v_users, '[]'::JSONB),
    'teams', COALESCE(v_teams, '[]'::JSONB),
    'schedules', COALESCE(v_schedules, '[]'::JSONB),
    'total_results', (
      COALESCE(jsonb_array_length(v_users), 0) +
      COALESCE(jsonb_array_length(v_teams), 0) +
      COALESCE(jsonb_array_length(v_schedules), 0)
    )
  );
  
  -- Log search
  INSERT INTO search_history (user_id, search_query, search_type, result_count)
  VALUES (
    _current_user_id, 
    _search_query, 
    'global', 
    (v_result->>'total_results')::INTEGER
  );
  
  RETURN v_result;
END;
$$;

-- RLS for search history
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search history"
ON search_history FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS for bookmarks
ALTER TABLE schedule_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own bookmarks"
ON schedule_bookmarks FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS for user favorites
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own favorites"
ON user_favorites FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());