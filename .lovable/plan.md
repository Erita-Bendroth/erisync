# Team Availability fix (JOEAR cannot see ERBET working)

## Root causes

Two distinct issues combine to produce the all-dashes view:

1. **RLS hides partner-team schedule entries.** `schedule_entries` is readable to a team member only when `team_id ∈ get_user_teams(auth.uid())`. ERBET is in team *Turbine Troubleshooting Offshore* (`c475eb9f…`), but his offshore-roster entries are stamped with team *Turbine Support Central* (`9e7d68b9…`). JOEAR is in the offshore team, so the RLS policy returns 0 rows for ERBET — `entries.length === 0` → "-".

2. **Offshore E/L/N branch is gated behind a manager-only lookup.** `useOffshorePartnershipTeams` reads `partnership_rotation_rosters`, whose RLS only allows admin / planner / manager. For team members the hook always returns `[]`, so `hasOffshore=false` and the view never enters the E/L/N branch — even when entries do exist.

## Plan

### 1. Make partnership teammates' schedule entries visible

Add a SELECT policy on `schedule_entries` allowing any authenticated user to read entries whose `user_id` belongs to a teammate within the same `team_planning_partners` group. Concretely: the row's `user_id` is a member of a team that shares a `team_planning_partners.team_ids` array with one of `get_user_teams(auth.uid())`.

Implemented as a `SECURITY DEFINER` helper, e.g. `is_partnership_teammate(_viewer uuid, _target uuid) returns boolean`, used in a new policy `"Partnership teammates view each other's schedules"`. No GRANT changes needed (table already granted to authenticated).

### 2. Let team members detect offshore partnerships

Add a SELECT policy on `partnership_rotation_rosters` allowing team members to read rows where the partnership's `team_ids` intersect their own teams. This keeps write paths admin/manager-only and only exposes `offshore_mode` / `status` to the people who need it for the availability view.

### 3. Show E/L/N regardless of offshore flag (per user request)

In `src/components/schedule/TeamAvailabilityView.tsx`, change the cell logic so the shift-code badge is driven purely by the entry's `shift_type`, not by partnership offshore flag:

- If any entry for the day has `shift_type ∈ {early, late, night}` → render the corresponding **E / L / N** badge (blue / amber / indigo, current styling).
- Otherwise fall back to the existing behaviour: green CheckCircle2 + "Available" when `availability_status === available`, red XCircle + "Unavailable" otherwise, "-" only when there are truly no entries for the day.
- Hotline badge keeps priority over E/L/N when both apply (unchanged).

`useOffshorePartnershipTeams` and the `userIsOffshore` gating can be removed from this view — the shift_type alone is sufficient and works for every team.

### 4. Verify

- Log in as JOEAR, open Schedule → Team Availability for the week of Jun 15: ERBET's row should show shift badges / Available for Mon–Thu.
- Confirm a team member in a non-offshore team still sees green/red availability for normal shifts and "-" only on days with no entries.

## Out of scope

- No changes to write/edit RLS, the roster builder, or how entries get their `team_id` stamped.
- No UI changes outside `TeamAvailabilityView`.
- Hotline assignment card is unchanged.
