

## Plan: Items 1, 2, 9, 10 — Non-Disruptive Consolidation

Goal: reduce duplication and bug surface **without** removing any visible functionality, route, or UI surface. Strategy = **redirect + alias + extract**, not delete.

---

### Item 1 — Consolidate the three dashboards (non-disruptive)

**Current**: `Dashboard` (`/dashboard`), `UnifiedDashboard` (`/unified-dashboard`), and `src/components/Dashboard.tsx` (unused legacy duplicate).

**Approach**:
- Keep `/dashboard` as the canonical route and keep its current content unchanged (this is the page users actually land on).
- Add a new tab inside `/dashboard` called **"Team Overview"** that mounts the existing `UnifiedDashboard` body (Quick Stats, Coverage Alerts, Holidays, Heatmap, Fairness, Activity).
- Convert `/unified-dashboard` into a redirect to `/dashboard?view=team-overview` (preserves any existing bookmarks/links).
- Delete the unused `src/components/Dashboard.tsx` (not imported anywhere — verified). Zero UX impact.

**Result**: one home, both surfaces still reachable, no functionality lost.

---

### Item 2 — Collapse partnership/roster module (non-disruptive)

**Current**: 13 files in `partnerships/` + 5 in `planning-partners/`. All are actively used.

**Approach** (refactor only, no visual change):
- Introduce a **`PartnershipWorkspace`** wrapper component with internal tabs **Build · Validate · Approve · History**, each tab simply rendering the existing component (`RosterBuilderDialog` body, `RosterValidationPanel`, `RosterApprovalPanel`, `RosterActivityLog`).
- `PartnershipRotationManager` keeps its current entry point and now opens `PartnershipWorkspace` instead of stacking 4 separate dialogs.
- `planning-partners/*` left untouched (different feature: shared planning calendar). Only add a JSDoc note clarifying the boundary so future devs don't duplicate again.
- No files deleted in this pass — components become children of the workspace. (Future cleanup can remove now-unused dialog wrappers once verified.)

**Result**: one workspace UI, but every existing button/flow still works.

---

### Item 9 — Shared `useScheduleEntries` hook (additive)

**Current**: schedule fetching reimplemented in `Dashboard.tsx`, `UnifiedDashboard.tsx`, `useSchedulerState`, `useCoverageAnalysis`, vacation hooks, etc. Each has its own React Query key shape → cache misses + redundant network calls.

**Approach**:
- Create `src/hooks/useScheduleEntries.ts` with a typed signature: `useScheduleEntries({ userIds?, teamIds?, startDate, endDate, includeProfiles?, includeTeams? })`.
- Standardised query key: `["schedule-entries", { userIds, teamIds, startDate, endDate }]`.
- **Do not refactor existing call sites in this pass.** New code uses it; migrate one consumer at a time later (low-risk incremental).
- Migrate **one** safe consumer now as proof: `pages/Dashboard.tsx`'s `fetchScheduleData` → uses the new hook. Keep all rendering identical.

**Result**: new hook available, one page proven, no behaviour change elsewhere.

---

### Item 10 — Centralize shift resolution (additive façade)

**Current**: `shiftResolver.ts`, `shiftTimeUtils.ts`, `shiftInstance.ts`, `shiftValidation.ts` — overlapping responsibilities. Recent stale-ID bug came from this fragmentation.

**Approach**:
- Add `src/lib/shiftService.ts` as a thin façade re-exporting a clear public API:
  - `shiftService.resolve(...)` → wraps `resolveShiftDefinition`
  - `shiftService.getTimes(...)` → wraps `getApplicableShiftTimes`
  - `shiftService.getTimesStrict(...)` → wraps `resolveShiftDefinitionStrict`
  - `shiftService.validate(...)` → wraps `shiftValidation`
  - `shiftService.expand(...)` → wraps `shiftInstance` expansion
- **Keep all existing modules and exports working** — nothing breaks. New code uses `shiftService`, old call sites unchanged.
- Add a short `README.md` in `src/lib/` explaining the boundary so new code goes through the façade.

**Result**: single canonical entry point exists; gradual migration possible without risk.

---

### Files touched

**New**
- `src/components/schedule/partnerships/PartnershipWorkspace.tsx`
- `src/hooks/useScheduleEntries.ts`
- `src/lib/shiftService.ts`
- `src/lib/README.md`

**Edited**
- `src/App.tsx` — convert `/unified-dashboard` route to redirect.
- `src/pages/Dashboard.tsx` — add "Team Overview" tab mounting `UnifiedDashboard` body; switch its own `fetchScheduleData` to `useScheduleEntries`.
- `src/pages/UnifiedDashboard.tsx` — export the body without the outer `<Layout>` so it can be embedded as a tab; keep default export for redirect compatibility.
- `src/components/schedule/partnerships/PartnershipRotationManager.tsx` — open `PartnershipWorkspace` instead of separate dialogs.

**Deleted**
- `src/components/Dashboard.tsx` (unused legacy duplicate — confirmed not imported).

### Verification after build
- `/dashboard` loads with original content + new "Team Overview" tab populated.
- `/unified-dashboard` redirects cleanly.
- Partnership manager opens new workspace; all 4 sub-functions reachable via tabs.
- Existing schedule cells, swap dialogs, bulk wizards untouched and working.
- `useScheduleEntries` returns same data shape as the old query in Dashboard.

### Out of scope (not in this pass)
- Removing `planning-partners/*`.
- Migrating other consumers to `useScheduleEntries` / `shiftService`.
- Deleting any partnership sub-components.
- Edge-function consolidation (separate plan).

