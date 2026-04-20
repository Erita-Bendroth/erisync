

## Plan: B (Swap Consolidation) + C (Data Fetching) + D (Vacation Consolidation)

Three independent passes. Each is safe in isolation — pick the order, or do all three.

---

### B — Collapse Swap Dialogs into One Wizard

**Problem.** 4 entry points (`ShiftSwapRequestDialog`, `ShiftSwapRequestButton`, `QuickSwapButton`, `ManagerDirectSwapDialog`) duplicate the same flow. `ShiftSwapWizard` already supports every mode.

**Plan.**
1. `ShiftSwapRequestButton` → render `<QuickSwapButton>` (already wraps `ShiftSwapWizard`). Keep prop signature, no caller changes.
2. `ShiftSwapRequestDialog` → thin shell that opens `ShiftSwapWizard` with the same props.
3. `ManagerDirectSwapDialog` → add a `mode="manager-direct"` to `ShiftSwapWizard` that skips the "request" step and writes the swap immediately. The dialog becomes a shell.
4. Delete the 3 obsolete files **after** confirming no remaining imports.

**Safety.** All public component names preserved as re-exports. Manager direct-swap audit log + coverage preview wired into the new wizard step (logic lifted, not rewritten).

---

### C — Standardize Data Fetching (Incremental, Zero-Risk)

**Concern: "How without impacting the rest of the setup?"** — Done **one component at a time**, behind the same React Query cache. Old code keeps working until each migration is verified.

**The two shared hooks already exist** and are battle-tested:
- `useScheduleEntries({ userIds, teamIds, startDate, endDate })`
- `useHolidayQuery({ dates, userIds, teamId })`

**Migration recipe (per component, ~5 min each):**
```ts
// BEFORE
const [entries, setEntries] = useState([]);
useEffect(() => {
  supabase.from('schedule_entries').select('*')
    .gte('date', start).lte('date', end)
    .in('user_id', userIds)
    .then(({ data }) => setEntries(data ?? []));
}, [userIds, start, end]);

// AFTER
const { data: entries = [], isLoading } = useScheduleEntries({
  userIds, startDate: start, endDate: end
});
```

**Why this is safe:**
- Same Supabase query, same shape returned.
- React Query **dedupes** — old ad-hoc queries don't conflict, they just become redundant until migrated.
- Each PR is 1 file. If anything breaks, revert just that file.
- No schema changes, no edge function changes, no RLS changes.

**Phased rollout — pick targets by impact:**
- **Phase 1 (high value):** `Dashboard.tsx`, `UnifiedDashboard.tsx`, `MonthlyScheduleView.tsx`, `PersonalMonthlyCalendar.tsx` — these load the same data simultaneously today.
- **Phase 2:** `TeamAvailabilityView`, `CoverageOverview`, `ManagerCoverageView`, `ScheduleView`.
- **Phase 3:** Analytics components.

**Bonus.** Once migrated, mutations (create/edit/delete shift) call `queryClient.invalidateQueries(['schedule-entries'])` and **every view refreshes automatically** — fixes the "I edited a shift but the dashboard is stale" class of bugs.

---

### D — Vacation Planning Consolidation

**Concern: "More explanation."** Today vacation lives in **6 separate surfaces**, each with its own entry button and modal:

| Surface | Where it lives | What it does |
|---|---|---|
| `VacationRequestModal` | Schedule page button | Submit a new request |
| `MyRequestsDialog` | Schedule page button | See *my* requests + status |
| `VacationRequestsList` | Schedule page section | Manager view of *team* requests |
| `PendingRequestsCard` | Dashboard widget | Manager: pending count |
| `VacationPlanningDashboard` | `/schedule?tab=vacation` | Capacity heatmap, fairness, recommendations |
| `VacationPipeline` | Inside planning dashboard | Approval queue |

Users have to know which button to click for which task. Managers especially get lost.

**Plan — one unified `/schedule?tab=vacation` view with sub-tabs:**
```text
Schedule page → [Schedule | Vacation | Coverage | …]
                            │
                            ▼
        ┌─────────────────────────────────────────┐
        │ Vacation                                │
        │ ┌─────────────────────────────────────┐ │
        │ │ [My Requests] [Team] [Planning]     │ │  ← role-aware sub-tabs
        │ │                                     │ │
        │ │ + "Request time off" button (top)   │ │  ← always visible
        │ └─────────────────────────────────────┘ │
        └─────────────────────────────────────────┘
```

**Sub-tab content (reuses existing components, no rewrites):**
- **My Requests** — `MyRequestsDialog` body, inlined (not a modal anymore). Everyone sees this.
- **Team** — `VacationRequestsList` + approval actions. Managers/planners only.
- **Planning** — existing `VacationPlanningDashboard` (capacity, fairness, what-if). Managers/planners only.

**Entry points consolidated:**
- "Request time off" button stays everywhere it is now (Schedule page header, Dashboard) → all open the same `VacationRequestModal`. No change to the request flow itself.
- `PendingRequestsCard` on Dashboard becomes a **link** ("3 pending requests →") that deep-links to `/schedule?tab=vacation&sub=team`.
- "My Requests" button on Schedule page → deep-links to `/schedule?tab=vacation&sub=my`.

**What stays the same:**
- The actual request submission modal (`VacationRequestModal`) — unchanged.
- Approval logic, notifications, holiday-skip behavior, coverage warnings — all unchanged.
- Database schema — unchanged.
- All 6 components keep existing as building blocks; we just stop having 6 separate doors.

**What changes:**
- 1 new file: `VacationCenter.tsx` — sub-tab container (~80 lines).
- Edits: `Schedule.tsx` (mount `VacationCenter` in vacation tab), `Dashboard.tsx` (`PendingRequestsCard` becomes a link).
- Deletions: none yet — we keep the originals as building blocks. Cleanup pass only after the new layout is confirmed.

**Safety.** No data layer touched. Pure UI re-arrangement. URL params (`?sub=my|team|planning`) make every old entry point reachable.

---

### Suggested order
1. **B** first — smallest, fully contained, immediate clarity win.
2. **D** next — biggest UX simplification users will feel, no risk.
3. **C** last, phased — performance + correctness foundation, but can be done forever in the background.

