-- Ensure parent_team_id column exists (in case previous migration didn't run)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'teams' 
    AND column_name = 'parent_team_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN parent_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_teams_parent_team_id ON public.teams(parent_team_id);
  END IF;
END $$;

-- Set up hierarchical relationships based on organizational structure
-- CENTRAL REGION
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Technical Operations Central')
WHERE name IN ('Turbine Operations Central', 'Plant Operations Central');

-- Turbine Operations Central children
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Turbine Operations Central')
WHERE name IN (
  'Turbine Support Central',
  'Turbine Troubleshooting Central - East',
  'Turbine Troubleshooting Central - South'
);

-- Plant Operations Central children
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Plant Operations Central')
WHERE name IN (
  'Plant Support Central - North',
  'Plant Support Central - South',
  'Plant Troubleshooting Central'
);

-- NORTH REGION
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Technical Operations North')
WHERE name IN ('Turbine Operations North', 'Plant Operations North');

-- Turbine Operations North children
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Turbine Operations North')
WHERE name IN (
  'Turbine Support North',
  'Turbine Troubleshooting North - West',
  'Turbine Troubleshooting North - Central',
  'Turbine Troubleshooting North - East'
);

-- Plant Operations North children
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Plant Operations North')
WHERE name IN (
  'Plant Support North',
  'Plant Troubleshooting North',
  'Pre-Config & Installation - NCE'
);

-- OFFSHORE REGION
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Technical Operations Offshore')
WHERE name IN ('Turbine Operations Offshore', 'Plant Operations Offshore');

-- Turbine Operations Offshore children
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Turbine Operations Offshore')
WHERE name IN (
  'Turbine Support Offshore',
  'Turbine Troubleshooting Offshore'
);

-- Plant Operations Offshore children (THIS IS KEY FOR MAOLM)
UPDATE public.teams 
SET parent_team_id = (SELECT id FROM public.teams WHERE name = 'Plant Operations Offshore')
WHERE name IN (
  'Plant Support Offshore - Cluster 1',
  'Plant Support Offshore - Cluster 2 & 3',
  'Plant Troubleshooting Offshore'
);

-- Add diagnostic function to verify hierarchy
CREATE OR REPLACE FUNCTION public.get_team_hierarchy(_team_id uuid)
RETURNS TABLE(
  team_id uuid,
  team_name text,
  level integer,
  path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE team_tree AS (
    -- Base case: start with the given team
    SELECT 
      id,
      name,
      parent_team_id,
      0 as level,
      name::text as path
    FROM public.teams 
    WHERE id = _team_id
    
    UNION ALL
    
    -- Recursive case: find all children
    SELECT 
      t.id,
      t.name,
      t.parent_team_id,
      tt.level + 1,
      tt.path || ' > ' || t.name
    FROM public.teams t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.id
  )
  SELECT id, name, level, path FROM team_tree ORDER BY level, name;
$$;