

## Plan: Unify Bulk Scheduler — Drop the Wizard, Keep One Fast Form

User feedback: the multi-step wizard is confusing. Make `BulkScheduleGenerator` (single-page form) the canonical entry point, and route the other two surfaces into it.

### Current state
- `BulkScheduleWizard` — 7-step wizard (Mode → Team → Dates → Partner → Shifts → Options → Review). Confusing.
- `BulkScheduleGenerator` — single-page form with sections. Faster, more familiar.
- `QuickBulkScheduler` — minimal "this week" shortcut.

All three write to the same `schedule_entries` table via similar logic.

### Approach
Single canonical component with **progressive disclosure** — basics visible by default, advanced collapsed.

1. **Promote `BulkScheduleGenerator` as the canonical UI.** Keep its sectioned layout (Mode • Team & People • Dates • Shifts • Advanced collapsible).
2. **Port wizard-only features into it** so nothing is lost:
   - Hotline mode (from `HotlineGenerationStep` + `HotlineDraftPreview`)
   - Rotation mode with per-date shift pattern (from `ShiftPatternStep`)
   - Partner coverage info panel (from `PartnerAvailabilityStep`) — render inline as a collapsible "Partner availability" card under Dates
   - Fairness + recurring options (already partially in Generator's advanced panel)
3. **Redirect the wizard**: `BulkScheduleWizard.tsx` becomes a thin shell that renders `<BulkScheduleGenerator />`. Any route/import using the wizard keeps working — no broken links.
4. **Keep `QuickBulkScheduler`** as-is (it's the "1-click this week" preset, not confusing). Optionally have it open the Generator pre-filled instead of being its own form — your call.
5. **Delete wizard step files** only after confirming the Generator covers every feature: `ModeSelectionStep`, `TeamPeopleStep`, `DateRangeStep`, `PartnerAvailabilityStep`, `ShiftConfigStep`, `ShiftPatternStep`, `AdvancedOptionsStep`, `ReviewStep`, `WizardProgress`. ~9 files, ~1500 lines removed.

### UI structure of the unified Generator
```text
[Mode tabs: Users | Team | Rotation | Hotline]
─────────────────────────────────────────────
Team & People        (changes per mode)
Date Range           + quick presets (This Week / Next / Month)
  └ Partner availability (collapsible, auto-expanded if conflicts)
Shifts               (single config OR per-date pattern for rotation)
─────────────────────────────────────────────
▸ Advanced options   (fairness, recurring, holiday skip, conflict handling)
─────────────────────────────────────────────
[Preview summary: X shifts across Y people]   [Cancel] [Generate]
```

### Safety
- Wizard route/import alias preserved → no broken links.
- Hotline draft-save flow preserved (the only async step the wizard had).
- Permission check (`admin/planner/manager`) preserved.
- All existing memory rules respected: skip-holidays logic, overwrite mode, country shift limits, weekend validation, rotation per-date times.

### Files
**Edit**
- `src/components/schedule/BulkScheduleGenerator.tsx` — add Hotline mode, Rotation per-date pattern, Partner availability panel, Review summary
- `src/components/schedule/wizard/BulkScheduleWizard.tsx` — replace body with `<BulkScheduleGenerator onScheduleGenerated={...} onCancel={...} />`

**Delete (after verification)**
- `src/components/schedule/wizard/ModeSelectionStep.tsx`
- `src/components/schedule/wizard/TeamPeopleStep.tsx`
- `src/components/schedule/wizard/DateRangeStep.tsx`
- `src/components/schedule/wizard/PartnerAvailabilityStep.tsx`
- `src/components/schedule/wizard/ShiftConfigStep.tsx`
- `src/components/schedule/wizard/ShiftPatternStep.tsx`
- `src/components/schedule/wizard/AdvancedOptionsStep.tsx`
- `src/components/schedule/wizard/ReviewStep.tsx`
- `src/components/schedule/wizard/WizardProgress.tsx`

### Out of scope
- Touching `QuickBulkScheduler` behavior (separate small pass if you want it).
- Edge function consolidation.
- Removing `useBulkSchedulerState` (Generator already uses it).

