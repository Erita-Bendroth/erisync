

## Fix: Initials Not Saved When Creating New Users

### Problem

The `create-user` edge function (line 148-158) inserts the initials value into `first_name` but **never sets the `initials` column** in the profiles table. The schedule grid and team member views read from `profiles.initials`, so newly created users appear without initials.

### Solution

Add `initials: initials` to the profile insert in the edge function.

### Changes

**File: `supabase/functions/create-user/index.ts`** (line ~151-158)

Update the profile insert to include the `initials` field:

```typescript
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .insert({
    user_id: newUserData.user!.id,
    first_name: initials,
    last_name: '',
    initials: initials,  // <-- ADD THIS
    email: email,
    country_code: countryCode || 'US',
    requires_password_change: true
  });
```

One line addition. This ensures the `initials` column is populated at user creation time, making initials visible immediately in the schedule and team views.

### Files
| File | Change |
|------|--------|
| `supabase/functions/create-user/index.ts` | Add `initials` field to profile insert |

