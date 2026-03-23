

## Fix: Race Condition in AuthProvider Wipes User Session

### Root Cause

In `src/components/auth/AuthProvider.tsx`, the `getSession()` callback calls `markInitialized(s)` unconditionally. When `getSession()` hangs for >8s, the timeout fires, user logs in fresh, but then the stale `getSession()` resolves and overwrites the valid session with null --- wiping the user mid-request.

This causes:
- Dashboard stuck on "Loading..." (queries lose auth mid-flight)
- Avatar shows "??" (profile query returns null because user was wiped)

### Fix

**File: `src/components/auth/AuthProvider.tsx`**

1. Guard `markInitialized` --- skip if already initialized via ref:
```typescript
const markInitialized = (s: Session | null) => {
  if (!mounted || initializedRef.current) return; // <-- add ref check
  setSession(s);
  setUser(s?.user ?? null);
  setLoading(false);
  setIsInitialized(true);
  initializedRef.current = true;
};
```

2. In the `onAuthStateChange` handler, keep the existing direct state updates for SIGNED_IN (these bypass `markInitialized` and always apply, ensuring late logins still work).

3. Change the fallback in `getDisplayInitials` from `'??'` to use the user's email initial as a last resort, falling back to `'?'` only if truly nothing is available.

**File: `src/lib/utils.ts`**

Update `getDisplayInitials` to accept an optional email parameter so UserMenu can pass `user?.email` as a final fallback instead of showing `'??'`.

**File: `src/components/navigation/UserMenu.tsx`**

Pass `user?.email` to `getDisplayInitials` so the avatar never shows `'??'`.

### Files
| File | Change |
|------|--------|
| `src/components/auth/AuthProvider.tsx` | Guard `markInitialized` with `initializedRef.current` check |
| `src/lib/utils.ts` | Add email fallback to `getDisplayInitials` |
| `src/components/navigation/UserMenu.tsx` | Pass user email to initials helper |

### Result
- Stale `getSession()` resolution can no longer overwrite a valid session
- Fresh login always wins over timeout state
- Avatar shows email-derived initial instead of `??` if profile is briefly delayed

