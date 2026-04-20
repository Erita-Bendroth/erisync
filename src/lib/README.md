# `src/lib/` — Boundaries

## Shift logic

All shift-definition logic should be accessed through **`shiftService`**:

```ts
import { shiftService } from "@/lib/shiftService";

const result = await shiftService.resolveStrict({ shiftType, date, personCountry, teamId });
const times  = await shiftService.getTimes({ ... });
const inst   = shiftService.expand(def, date, tz);
const ok     = await shiftService.validate(shiftType, date, country);
```

Underlying modules (`shiftResolver`, `shiftTimeUtils`, `shiftInstance`,
`shiftValidation`) remain available for backwards compatibility but new code
should not import them directly. Centralising through the façade prevents
the kind of stale-`shift_time_definition_id` drift that has bitten the
partnership scheduler in the past.

## Partnerships vs. Planning Partners

- `src/components/schedule/partnerships/` — **rotation rosters** (multi-team
  weekly cycles with build → validate → approve → activate workflow).
  Wrapped by `PartnershipWorkspace`.
- `src/components/schedule/planning-partners/` — **shared planning calendar**
  (cross-team day-by-day visibility). A different feature; do not merge.
