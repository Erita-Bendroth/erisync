1. Export a `describeRecoveryRule(shift)` helper from `src/lib/offshorePattern.ts` that uses the existing `effectiveRecoveryRule` and returns short strings:
   - Single-shift line: e.g. "No WO for a single shift" or "1 WO after a single shift"
   - Long-block line (when threshold is set): e.g. "1 WO before & 1 WO after if block > 5"
   - For non-working codes: nothing (the Non-working badge already covers it)
   - For unrecognized custom codes: fall back to the raw before/after/longBlock wording so user-defined codes still display correctly.

2. In `src/components/schedule/partnerships/OffshorePatternPanel.tsx`, replace the inline `recovery_rule?.before / after / longBlockAfter` spans with the strings from `describeRecoveryRule(c)`, rendered as small muted text under the Working/Non-working badge.

Result: Early and Late rows show "No WO for a single shift · 1 WO before & 1 WO after if block > 5", Night shows "1 WO after a single shift · 1 WO before & 2 WO after if block > 5", Day shows nothing extra, WO stays as Non-working — matching the actual grid behavior.