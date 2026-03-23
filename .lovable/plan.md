

## Fix: Initials Not Saved When Creating Users (Root Cause Found)

### Problem

There is a **race condition** between the `handle_new_user` trigger and the edge function:

1. Edge function calls `supabaseAdmin.auth.admin.createUser()` with `user_metadata: { initials: "NIBAD" }`
2. This fires the `on_auth_user_created` trigger → `handle_new_user()` runs and creates a profile row with `first_name: ''`, `last_name: ''`, `initials: NULL` (trigger doesn't extract initials from metadata)
3. Edge function then tries `INSERT INTO profiles(...)` with `initials: 'NIBAD'` → **fails silently** due to the `UNIQUE(user_id)` constraint — the row already exists from step 2

Database evidence confirms this: `nibad@vestas.com` has `first_name: ''`, `initials: NULL` — the trigger created the row, and the edge function's insert was rejected.

### Solution (3 changes)

**1. Fix the edge function to use UPSERT instead of INSERT**

**File: `supabase/functions/create-user/index.ts`**

Change `.insert(...)` to `.upsert(...)` so it updates the trigger-created row:

```typescript
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .upsert({
    user_id: newUserData.user!.id,
    first_name: initials,
    last_name: '',
    initials: initials,
    email: email,
    country_code: countryCode || 'US',
    requires_password_change: true
  }, { onConflict: 'user_id' });
```

**2. Update the `handle_new_user` trigger to also extract initials from metadata**

**Database migration:**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email, initials)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', COALESCE(NEW.raw_user_meta_data ->> 'initials', '')),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
        NEW.email,
        NEW.raw_user_meta_data ->> 'initials'
    );
    RETURN NEW;
END;
$$;
```

**3. Backfill existing profiles with missing initials**

```sql
UPDATE public.profiles
SET initials = first_name
WHERE (initials IS NULL OR initials = '')
  AND first_name IS NOT NULL
  AND first_name != '';
```

### Files to Modify

| File / Resource | Change |
|------|--------|
| `supabase/functions/create-user/index.ts` | Change `.insert()` to `.upsert()` with `onConflict: 'user_id'` |
| Database migration | Update `handle_new_user` trigger to extract initials from metadata |
| Database migration | Backfill existing profiles with `initials = first_name` where missing |

