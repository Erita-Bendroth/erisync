

## Fix: Infinite Loop in useHomeOfficeCompliance (Root Cause of Remove Failure)

### Problem

The `referenceDate` dependency on line 155 uses the raw `Date` object. Since the default parameter `new Date()` on line 34 creates a new object every render, `useCallback` recreates `fetchCompliance` on every render, which triggers the `useEffect` on every render, causing an infinite loop of Supabase requests. This floods the browser's network stack, causing all other requests (including the team member delete) to fail with `TypeError: Failed to fetch`.

**This fix was planned previously but never actually applied.**

### Solution

Stabilize the `referenceDate` dependency by converting it to a string for the dependency array.

### Changes

**File: `src/hooks/useHomeOfficeCompliance.ts`**

1. Add a stable date string derived from `referenceDate`:
   ```typescript
   const referenceDateStr = format(referenceDate, 'yyyy-MM-dd');
   ```

2. Change the `useCallback` dependency from `referenceDate` to `referenceDateStr`:
   ```typescript
   }, [userId, providedCountryCode, referenceDateStr]);
   ```

This ensures `fetchCompliance` is only recreated when the actual date value changes, not on every render. The infinite loop stops, network requests normalize, and the remove team member action will work reliably.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useHomeOfficeCompliance.ts` | Replace `referenceDate` with `referenceDateStr` in useCallback deps |

