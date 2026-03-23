

## Fix: App Stuck on "Loading... Initializing application" on Deployed Site

### Problem

The `AuthProvider` shows a full-screen loading overlay while `!isInitialized`. The `isInitialized` flag is only set to `true` after `supabase.auth.getSession()` resolves. If the Supabase connection stalls (e.g., during/after migration deployment), the app stays stuck forever with no recovery path.

### Solution

Add a safety timeout to the AuthProvider initialization. If auth hasn't resolved within 5 seconds, force `isInitialized = true` and `loading = false` so the app renders (unauthenticated users will see the login page, authenticated users will proceed normally once the session eventually resolves).

### Change

**File: `src/components/auth/AuthProvider.tsx`**

Inside the `useEffect`, add a timeout that forces initialization after 5 seconds:

```typescript
useEffect(() => {
  let mounted = true;

  // Safety timeout - don't stay stuck on loading forever
  const timeout = setTimeout(() => {
    if (mounted && !isInitialized) {
      console.warn('Auth initialization timed out, proceeding without session');
      setLoading(false);
      setIsInitialized(true);
    }
  }, 5000);

  // ... existing auth listener and getSession code ...

  return () => {
    mounted = false;
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}, []);
```

This ensures the app never gets permanently stuck on the loading screen, regardless of network conditions or migration timing.

### Files
| File | Change |
|------|--------|
| `src/components/auth/AuthProvider.tsx` | Add 5-second safety timeout for initialization |

