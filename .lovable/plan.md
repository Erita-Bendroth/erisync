## Background — what the Excel reveals

Re-scanning Calendar 2026 for every pair of people that share the same E/L/N shift on non-handover days (Tue–Sun) gives a very clean signal:

| Pair | Shared duty days | Breakdown |
|---|---|---|
| **CHKME ↔ JOEAR** | 36 | N: 18, L: 12, E: 6 |
| **DAPHA ↔ STOYL** | 29 | L: 14, E: 9, N: 6 |
| everyone else | ≤ 5 | only handover noise |

So the "shadow rule" exists for **exactly two pairs** in this team — a senior + trainee/buddy that does the same duty week together. Everything else collapses into normal Monday handover overlap. The rule must therefore be **per-pair, not team-wide**, and must apply to every E/L/N week the senior gets in the rotation.

## What to build

### 1. Shadow pairs on the partnership (offshore mode)

A new table `partnership_shadow_pairs` stored per partnership:

```
id, partnership_id, lead_user_id, shadow_user_id,
applies_to (text[] of shift codes — default {E,L,N}),
active (bool), notes, created_at/updated_at, created_by
```

Managed from `OffshorePatternPanel.tsx` in a new "Shadow pairs" card under the shift-code library:
- Add / remove pair (two member pickers limited to partnership members)
- Multi-select which shift codes the shadow follows (default E, L, N — Day/WO never)
- Pair is symmetric only in display; lead = the person whose duty week is mirrored

### 2. Auto-apply shadow when painting in `OffshoreRosterDayGrid`

When the user paints an E/L/N anchor for a *lead* on day `d`:
1. Run the existing `applyShiftWithRecovery` for the lead (unchanged).
2. For each active shadow paired with that lead on a code in `applies_to`, copy the same anchor onto the shadow's row for the **Tue–Sun** of that lead's block (skip the handover Mon, which is the existing WO day). Re-run `applyShiftWithRecovery` on the shadow's row so their own WO recovery rules paint correctly.
3. If the shadow already has a manual non-WO entry on any of those days (vacation X, training T, blocked B equivalents), skip that day only and surface an inline toast: *"Shadow JOEAR not mirrored on 2026-05-18 — existing assignment kept"*.

A small `shadowOf(userId, code)` helper in `offshorePattern.ts` returns the list of shadow user ids per lead/code.

Manual override stays possible: deleting a cell on the shadow does not re-trigger the copy (only painting the lead does). A "Re-sync shadows" button on the grid recomputes all shadow rows from the current lead rows on demand.

### 3. Coverage warning — minimum 1 on E / L / N

**Source of truth** for the minimum: the existing `partnership_shift_requirements` table already lets a manager configure `staff_required` per shift code. We treat it as: "On every calendar day, at least N anchors must exist for this code." Default seeded value for E, L, N when offshore mode is enabled = **1** (overrides the current week-based check for offshore rosters).

**Roster builder warning (`OffshoreRosterDayGrid`):**
- New `useOffshoreCoverage(rosterId, codes, requirements)` hook computes, per date in the roster range, the count of anchors per shift code and returns `{ date, code, required, actual, isShort }[]`.
- A red `Alert` banner above the grid: *"Coverage gap: 12 day(s) below minimum staffing"* with an expand-to-list toggle.
- Day-cell decoration: any date where any E/L/N count is below required gets a thin red top border + tooltip listing the short codes.
- Already-existing `RosterValidationPanel` gets a new section "Daily coverage" showing the same warnings (separate from the week-grid validation it does today).

**Schedule view warning (Turbine Troubleshooting Offshore):**
- New `useOffshoreScheduleCoverage(teamIds, dateRange)` hook — runs only when the displayed team(s) belong to a partnership in offshore mode. It pulls `schedule_entries` for the range, counts work-anchors per shift_type per day, and compares against partnership_shift_requirements (or the seeded default of 1 for early/late/night).
- A new `OffshoreCoverageBanner` rendered at the top of `ScheduleView` and `MultiTeamScheduleView` when the active team is offshore: shows a red banner *"⚠ 3 day(s) this month have no E/L/N coverage"* with click-to-jump-to-date.
- In `MonthlyScheduleView` / `MultiTeamScheduleView`, each day header gets a small red dot when that day is short on E, L, or N.

### 4. Defaults & seeding

When `OffshorePatternPanel` first auto-enables offshore mode (existing logic), also upsert `partnership_shift_requirements` rows for codes E, L, N with `staff_required = 1` if none exist for that partnership.

## Technical details

**New migration**

```sql
create table public.partnership_shadow_pairs (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.team_planning_partners(id) on delete cascade,
  lead_user_id uuid not null references auth.users(id) on delete cascade,
  shadow_user_id uuid not null references auth.users(id) on delete cascade,
  applies_to text[] not null default '{E,L,N}',
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (partnership_id, lead_user_id, shadow_user_id)
);

grant select, insert, update, delete on public.partnership_shadow_pairs to authenticated;
grant all on public.partnership_shadow_pairs to service_role;
alter table public.partnership_shadow_pairs enable row level security;

-- read: any member of a team in the partnership
create policy "shadow_pairs_read" on public.partnership_shadow_pairs for select
  to authenticated using (
    exists (
      select 1 from public.team_planning_partners tpp
      join public.team_members tm on tm.team_id = any(tpp.team_ids)
      where tpp.id = partnership_id and tm.user_id = auth.uid()
    )
  );

-- write: managers of any team in the partnership, or admin/planner
create policy "shadow_pairs_write" on public.partnership_shadow_pairs for all
  to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'planner')
    or exists (
      select 1 from public.team_planning_partners tpp
      where tpp.id = partnership_id
        and exists (
          select 1 from public.team_members tm
          where tm.team_id = any(tpp.team_ids) and tm.user_id = auth.uid() and tm.is_manager
        )
    )
  ) with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'planner')
    or exists (
      select 1 from public.team_planning_partners tpp
      where tpp.id = partnership_id
        and exists (
          select 1 from public.team_members tm
          where tm.team_id = any(tpp.team_ids) and tm.user_id = auth.uid() and tm.is_manager
        )
    )
  );
```

**New / changed files**

- `src/hooks/usePartnershipShadowPairs.ts` — CRUD + realtime cache
- `src/lib/offshorePattern.ts` — add `mirrorShadowOnPaint(leadUserId, code, dates, pairs, ...)` helper used by the grid
- `src/components/schedule/partnerships/ShadowPairsPanel.tsx` — UI card embedded in `OffshorePatternPanel.tsx`
- `src/components/schedule/partnerships/OffshoreRosterDayGrid.tsx` — call mirror on paint, surface coverage banner, render red borders on short days, add "Re-sync shadows" button
- `src/hooks/useOffshoreCoverage.ts` — per-day E/L/N count vs requirement (roster mode)
- `src/hooks/useOffshoreScheduleCoverage.ts` — same against `schedule_entries` for live schedule
- `src/components/schedule/OffshoreCoverageBanner.tsx` — banner used by ScheduleView and MultiTeamScheduleView
- `src/components/schedule/ScheduleView.tsx`, `MultiTeamScheduleView.tsx`, `MonthlyScheduleView.tsx` — render banner + per-day red-dot marker when team is offshore
- `src/components/schedule/partnerships/RosterValidationPanel.tsx` — add "Daily coverage" section feeding off `useOffshoreCoverage`

**Out of scope (ask first if needed)**

- Notifications/emails on coverage gaps
- Auto-suggesting replacements when a shadow can't mirror
- Cross-partnership shadow pairs

## Verification

1. Seed two pairs (CHKME→JOEAR, DAPHA→STOYL) and paint an E week on CHKME — confirm JOEAR auto-fills Tue–Sun, both have correct WO recovery, and the lead/shadow Excel pattern reproduces.
2. Delete a single shadow cell and confirm coverage banner updates on the next render.
3. Set `staff_required = 1` for E and remove the only E anchor for one day — confirm red border + banner count increments in the grid and in the live ScheduleView.
4. Confirm a non-offshore partnership shows no banner and no extra UI.