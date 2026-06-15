I understand now: WO is not tied to every Early/Late shift. It depends on the shift type and whether it is a long consecutive block.

Plan:

1. Update the recovery rule model
   - Add support for WO days before a long block separately from WO days before every single shift.
   - Keep regular `after` for standalone Night shifts only.
   - Use long-block rules only when the same shift code is assigned consecutively for more than 5 days, meaning 6+ shifts.

2. Set the offshore defaults to match your rules exactly
   - Night:
     - 1 Night shift -> 1 WO after only.
     - 6+ consecutive Night shifts -> 1 WO before the block and 2 WO after the block.
   - Late:
     - 1 Late shift -> no WO.
     - 6+ consecutive Late shifts -> 1 WO before the block and 1 WO after the block.
   - Early:
     - 1 Early shift -> no WO.
     - 6+ consecutive Early shifts -> 1 WO before the block and 1 WO after the block.

3. Fix the placement logic
   - Calculate recovery once per consecutive block, not once per individual shift.
   - Put the “before” WO before the first day of the block.
   - Put the “after” WO after the last day of the block.
   - Do not create WO after a single Early or Late shift.

4. Protect existing offshore rosters/settings
   - Existing Early/Late codes that currently have no rule, or still have the old single-WO-after rule, will be interpreted with the corrected long-block-only behavior.
   - Existing Night codes will be interpreted with the corrected Night behavior, including the 6+ long-block threshold.

5. Update validation and wording
   - Validation warnings will use the same block-based logic as assignment.
   - UI labels/help text will say “more than 5 shifts” instead of implying every Early/Late shift gets recovery.

Technical detail:
```text
N x1          -> N WO
N x6          -> WO N N N N N N WO WO
E x1          -> E
E x6          -> WO E E E E E E WO
L x1          -> L
L x6          -> WO L L L L L L WO
```