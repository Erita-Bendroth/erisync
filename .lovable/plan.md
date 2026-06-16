## Root cause

`useOffshoreCoverage` queries `roster_day_assignments` with `.eq("roster_id", …).eq("is_anchor", true)` and `useOffshoreScheduleCoverage` queries `schedule_entries` with a date+team filter. Both rely on PostgREST's default response cap (1000 rows).

The active offshore roster has **1592 anchor rows** — so the query silently drops ~592 of them. Sep 21 happens to fall in the truncated tail for the E (and N) shift codes, even though the database clearly has AKEAN's `E` (anchor=true, shift_type=early) and DAPHA's `L` (anchor=true, shift_type=late) on that day. The coverage memo only sees DAPHA's L, so it (incorrectly) reports `E:0/1` alongside the genuine `N:0/1` gap. This is why the screenshot's banner says "87 days below minimum" — many of those E/L gaps are false positives caused by truncation.

## Fix

Paginate both hook queries so we always load the full set, then keep the existing counting / gap logic untouched.

### 1. `src/hooks/useOffshoreCoverage.ts`
- Replace the single `roster_day_assignments` select with a `fetchAllPages` helper that loops `.range(from, from + pageSize - 1)` (page size 1000) until a page returns fewer than `pageSize` rows.
- Same pattern for any future >1000-row tables, but requirements stay a single query.

### 2. `src/hooks/useOffshoreScheduleCoverage.ts`
- Apply the same paginated fetch to the `schedule_entries` query (a partnership covering 17 members × 90+ days will exceed 1000 rows quickly).
- Leave the offshore-detection and requirements queries as single calls (they stay tiny).

### 3. Sanity check after fix
- Re-open the roster editor for partnership `814eec96…` and confirm the banner drops from 87 to the actual count, and Sep 21 lists only `N:0/1` (no E).
- Confirm the schedule-view banner shows the same numbers.

No UI, no schema, no business-logic changes — only the data-fetching layer of the two coverage hooks.
