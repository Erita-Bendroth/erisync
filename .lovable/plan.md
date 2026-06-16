## Goal
Make `request-shift-coverage` actually send emails by switching it from the non-existent `send-transactional-email` invoke to Resend directly, matching the pattern used by `send-swap-notification`, `send-schedule-notification`, and `vacation-request-notification`.

## Changes

**`supabase/functions/request-shift-coverage/index.ts`**
1. Add `import { Resend } from "npm:resend@2.0.0"` and instantiate with `Deno.env.get("RESEND_API_KEY")`.
2. Remove the loop that calls `supabase.functions.invoke("send-transactional-email", ...)`.
3. Replace with direct `resend.emails.send(...)` per recipient:
   - `from: "EriSync <noreply@erisync.xyz>"`
   - `subject: "Coverage needed: <ShiftLabel> on <FormattedDate>"`
   - Inline HTML body: greeting, shift + date, team, optional manager notes, CTA button linking to `${APP_URL}/schedule?openRequest=<id>`, footer.
4. Wrap each send in try/catch so a single failure doesn't abort the batch; increment `emailsSent` only on success and log failures.
5. Keep all existing logic: permission checks, DB insert into `open_shift_requests`, in-app notification inserts, response shape.

## Out of scope
- DB schema, RLS, claim trigger, UI components, hooks — all unchanged.
- No new templates or shared email utilities; inline HTML stays consistent with sibling functions.

## Verification
- Deploy `request-shift-coverage`.
- Trigger a coverage request from `OffshoreCoverageBanner` as a manager.
- Check edge function logs for `emailsSent` count and any Resend errors.
- Confirm recipient inbox delivery.
