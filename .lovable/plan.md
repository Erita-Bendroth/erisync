
## Plan: Substitute Coverage for Any Absence

Managers can nominate a substitute for **any** unavailability (vacation, sick leave, training, out-of-office, public holiday, FZA withdrawal, etc.), independently of the vacation-request workflow. The link is visible everywhere the absence shows up.

---

### Privacy rule (important)

The **reason for the absence is private** and is shown **only to the manager** (and admins/planners). It is never shown to:
- The substitute
- Other team members viewing the schedule
- Anyone in tooltips, badges, or notifications

Public-facing copy (badges, tooltips, notifications) refers only to "covering for {name} on {date}" — never the reason.

---

### Data model

New table `substitute_assignments`:

```text
substitute_assignments
  id                  uuid pk
  date                date          not null
  team_id             uuid          not null  -> teams.id
  absent_user_id      uuid          not null  -> profiles.user_id
  substitute_user_id  uuid          not null  -> profiles.user_id
  reason              text          null      -- manager-only: "vacation", "training", "sick", free text
  notes               text          null      -- manager-only
  absence_entry_id    uuid          null      -> schedule_entries.id (on delete set null)
  created_by          uuid          not null
  created_at / updated_at
  unique (date, team_id, absent_user_id)
```

Why this shape:
- **`date + team_id + absent_user_id` is the natural key** — works whether or not a `schedule_entries` row exists. Manager can pre-assign a substitute before any absence is logged.
- `absence_entry_id` is a soft FK — set to NULL on absence delete so the substitute assignment survives.
- `reason` is free text (not enum) so it covers everything; visibility is controlled by RLS + a view, not by the column itself.
- Single substitute per absent person per day.

#### Visibility — two-layer

RLS on `substitute_assignments`:
- Managers (via `get_manager_accessible_teams`) + admins/planners → ALL columns, full CRUD.
- Team members (including the substitute and the absent person themselves) → SELECT, **but `reason` and `notes` are stripped** before reaching the client.

Implementation: a SECURITY DEFINER view `substitute_assignments_public` exposes `(id, date, team_id, absent_user_id, substitute_user_id)` only. Non-managers query the view; managers query the table directly. Hook picks the right source based on role.

---

### Manager UX — assigning a substitute

One shared dialog **`SubstituteAssignmentDialog`**, opened from multiple entry points:

```
Substitute Coverage
  Absent person:   [auto-filled or picker]
  Date(s):         [date / range]
  Reason:          [Vacation ▾ | Sick | Training | Other (free text)]   ← manager-only
  Substitute:      [Teammate picker — annotated with availability]
  Notes:           [optional, manager-only]
  [Cancel]  [Save]
```

Entry points:
1. **Schedule grid cell** — `InlineEditPopover` adds an "Assign substitute" action on every cell where the manager has edit rights. Auto-fills user + date.
2. **Schedule page header** — new top-level **"Assign substitute"** button (manager/admin/planner only) → empty dialog, full picker.
3. **VacationCenter** — "Assign substitute" button on approved requests, pre-fills the range. Convenience only — independent of approval.
4. **Absence cell context menu** — right-click / overflow on any unavailability cell → "Assign substitute".

Picker rules:
- Candidates = members of the absent user's team(s), excluding the absent person.
- Each annotated: "Available", "On late shift", "Already covering X", "Unavailable". Manager can still pick, but unavailable choices show a warning.
- Date range: one substitute for all days, or per-day editor.

---

### Display — where the substitute shows up

Shared `<SubstituteBadge />` (small avatar + arrow + initials).

| Audience | Tooltip / badge text |
|---|---|
| **Manager / admin / planner** | "Covered by Jane Doe — Training" (reason + notes shown) |
| **Substitute, absent person, teammates** | "Covered by Jane Doe" — no reason, no notes |

Used in:

| View | Where |
|---|---|
| Schedule page — `MonthlyScheduleView`, `MultiTeamScheduleView`, `TeamAvailabilityView`, `ManagerCoverageView`, `ScheduleView` | Inside the absence cell |
| Team Scheduler `SchedulerGrid` / `SchedulerCell` | Same badge; tooltip extended via `SchedulerCellWithTooltip` (audience-aware text) |
| Substitute's own cell that day | Subtle "↶ Covering A.B." chip (no reason) |
| `PersonalMonthlyCalendar` | "Covering for X" hint on relevant days |
| Dashboard (`Dashboard.tsx`, `UnifiedDashboard.tsx`) | "Today: Covering for X" line if applicable |
| `CoverageOverview` / `ManagerCoverageView` | Coverage counts treat substitute as effectively present |

---

### Hooks & cache

- `useSubstituteAssignments({ teamIds, startDate, endDate })`
  - Selects from `substitute_assignments` (manager) or `substitute_assignments_public` (everyone else).
  - Returns rows indexed by `(date, absent_user_id)` and `(date, substitute_user_id)`.
- All mutations invalidate `['substitute-assignments', ...]` and `['schedule-entries']` (so coverage counts refresh — leverages the Phase 1/2 cache work).

---

### Notifications

All public-facing notification copy omits the reason:

- **Substitute on assignment**: *"You've been assigned as substitute for Alex on May 12."*
- **Substitute on date-range assignment**: *"You've been assigned as substitute for Alex from May 12–14."*
- **Absent person (optional, default on)**: *"Jane will cover for you on May 12."*
- **Manager** (when a sub later becomes unavailable, fired by `AFTER INSERT/UPDATE` trigger on `schedule_entries`): *"Jane is now unavailable on May 12 — please reassign coverage for Alex."* — manager only, includes context.

No automatic unassignment ever; manager always confirms reassignment.

---

### Side effects

- **Substitute becomes unavailable later** → trigger detects and notifies manager (above).
- **Absence entry deleted** → `absence_entry_id` set to NULL (FK on delete set null); substitute assignment remains so manager can decide whether to keep coverage.
- **Substitute assignment deleted** → notify substitute: *"Your substitute assignment for Alex on May 12 was removed."*

---

### Out of scope

- Multiple substitutes per day / split coverage.
- Auto-suggestion (fairness-weighted) — can reuse `vacation-recommendations` pattern later.
- Substitute acceptance/decline workflow — manager assignment is final.
- Inclusion in ICS/PDF schedule exports.

---

### Implementation order

1. Migration: `substitute_assignments` table + RLS + `substitute_assignments_public` view + sync trigger for `absence_entry_id`.
2. Hook `useSubstituteAssignments` (role-aware source selection) + `<SubstituteBadge />` (audience-aware text).
3. `SubstituteAssignmentDialog` (range-aware).
4. Wire entry points: `InlineEditPopover`, Schedule page header button, VacationCenter button, cell context menu.
5. Render badge across schedule views (one PR per view family).
6. Conflict-detection trigger + notifications (reason-free copy).

---

### Memory updates after implementation

- `mem://features/substitute-assignments` — manager-driven, covers any absence type, single sub per day, badge across all schedule views.
- `mem://security/substitute-reason-private` — reason and notes visible to managers/admins/planners only; never shown in public badges, tooltips, or notifications. Enforced via dedicated public view + audience-aware UI.
