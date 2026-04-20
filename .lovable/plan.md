

The preview shows a blank `/auth` page — likely a runtime error from the recent consolidation. Most probable causes:

1. `Dashboard.tsx` now imports `UnifiedDashboardBody` — if the named export wasn't actually added to `UnifiedDashboard.tsx`, the whole app crashes at module load.
2. `App.tsx` redirect for `/unified-dashboard` may have a bad import (e.g. `Navigate` from `react-router-dom`).
3. `PartnershipRotationManager.tsx` may reference `PartnershipWorkspace` props incorrectly.

### Investigation plan
- View `src/pages/UnifiedDashboard.tsx` — confirm `UnifiedDashboardBody` is exported.
- View `src/pages/Dashboard.tsx` — confirm imports + tab wiring + `useScheduleEntries` usage.
- View `src/App.tsx` — confirm redirect import.
- View `src/components/schedule/partnerships/PartnershipRotationManager.tsx` — confirm new workspace wiring.
- Check console logs from the preview for the actual runtime error.

### Fix plan
Once the failing import/symbol is identified, apply the minimal fix:
- Add the missing named export, OR
- Restore the original `Dashboard.tsx` data fetch if `useScheduleEntries` shape mismatches, OR
- Correct the redirect component.

If multiple files have issues, fix all in one pass and reload.

### Fallback
If the root cause isn't a quick fix, recommend reverting the last AI message via the chat revert button to restore the working state instantly, then reapply changes more carefully.

