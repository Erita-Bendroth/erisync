We will correct the offshore roster logic to match the screenshot: a single Early (E) or Late (L) shift must not automatically create a WO the next day.

Plan:
1. Update the offshore shift preset
   - Change the default E and L recovery rules from “1 WO after” to no automatic recovery.
   - Keep Night (N) recovery behavior separate, since night shifts still have their own before/after rules.

2. Protect existing offshore setups from the old rule
   - Treat existing E/L shift codes with the old `{ after: 1 }` rule as no automatic recovery when assigning cells, so rosters already seeded with the old preset stop creating wrong WO days.
   - Prevent validation warnings from expecting WO after standalone E/L shifts.

3. Adjust the UI wording
   - Update the shift palette/help text so it no longer implies every E/L code auto-fills WO after the shift.
   - Keep wording focused on recovery only where a code actually has a valid recovery rule.

4. Verify the exact cases from the screenshot
   - Assign one E on Monday → Tuesday stays blank unless manually assigned.
   - Assign one L on Monday → Tuesday stays blank unless manually assigned.
   - Existing Night recovery behavior remains unchanged.