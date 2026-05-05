I checked the live database constraint and it is still requiring at least 2 teams:

```sql
CHECK ((array_length(team_ids, 1) >= 2))
```

The app code already allows selecting 1 team, and the migration file exists in the codebase, but the live database has not actually applied that constraint change yet. That is why you still see:

```text
violates check constraint "team_ids_not_empty"
```

Plan:

1. Apply the database constraint fix to the live Supabase database:

```sql
ALTER TABLE public.team_planning_partners
DROP CONSTRAINT IF EXISTS team_ids_not_empty;

ALTER TABLE public.team_planning_partners
ADD CONSTRAINT team_ids_not_empty
CHECK (array_length(team_ids, 1) >= 1);
```

2. Verify the live database now shows:

```sql
CHECK ((array_length(team_ids, 1) >= 1))
```

3. Re-test creating a partnership with exactly one selected team.

No frontend change is needed for this specific error, because `PlanningPartnershipManager.tsx` already validates `selectedTeamIds.length < 1` and the UI label already says `minimum 1`.