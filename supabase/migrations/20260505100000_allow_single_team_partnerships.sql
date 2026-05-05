-- Allow planning partnerships with a single team
ALTER TABLE public.team_planning_partners DROP CONSTRAINT IF EXISTS team_ids_not_empty;
ALTER TABLE public.team_planning_partners ADD CONSTRAINT team_ids_not_empty CHECK (array_length(team_ids, 1) >= 1);
