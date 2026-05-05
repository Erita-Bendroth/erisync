## Goal

Clear the 4 remaining warning-level findings from the Supabase linter while preserving every existing feature, RLS policy, and user-visible behavior. All errors from the previous sweep are already fixed.

## Remaining findings

1. `SUPA_anon_security_definer_function_executable` — anon role can EXECUTE SECURITY DEFINER functions in `public`.
2. `SUPA_authenticated_security_definer_function_executable` — authenticated role can EXECUTE SECURITY DEFINER functions in `public`.
3. `SUPA_pg_graphql_anon_table_exposed` — anon can see tables in the GraphQL schema.
4. `SUPA_pg_graphql_authenticated_table_exposed` — authenticated can see tables in the GraphQL schema.

## Guiding principle

The app is fully authenticated — there is no pre-login data flow. Every RPC call and table read happens after sign-in via the `authenticated` role. Therefore:

- We CAN safely revoke from `anon` without breaking anything (no anonymous flows exist).
- We CANNOT broadly revoke from `authenticated` — that would break the entire app.

So findings 1 and 3 will be fixed by revoking anon. Findings 2 and 4 will be marked as accepted risks in the security memory, with rationale, because the app's design requires authenticated users to call RPCs and read tables they have RLS access to.

## Plan

### Step 1 — Migration: revoke anon access

Single migration that:

- Iterates every SECURITY DEFINER function in `public` and runs `REVOKE EXECUTE ... FROM anon`.
- Iterates every table in `public` and runs `REVOKE SELECT, INSERT, UPDATE, DELETE ON ... FROM anon`.
- Re-grants `EXECUTE` to `authenticated` and `service_role` on every SECURITY DEFINER function (defensive — preserves current behavior).
- Re-grants `SELECT, INSERT, UPDATE, DELETE` to `authenticated` and `service_role` on every table (defensive — RLS still gates rows).

Implementation will use a `DO $$ ... $$` block looping over `pg_proc` / `pg_tables` so no function or table is missed and none are individually named (safe against future additions).

This closes findings 1 and 3 without changing any RLS policy, function body, or app code.

### Step 2 — Mark findings 2 and 4 as accepted

For `SUPA_authenticated_security_definer_function_executable` and `SUPA_pg_graphql_authenticated_table_exposed`:

- Mark as `ignore` via the security tool with rationale: "App is fully authenticated. All RPCs and tables are intentionally callable/visible to the `authenticated` role; row-level access is gated by RLS policies and SECURITY DEFINER functions enforce role checks internally (e.g. `has_role`, `is_planner`, `is_manager_for_team`). Removing authenticated access would break every feature."

### Step 3 — Update security memory

Append a section documenting:

- Anon role has no access to `public` (functions or tables).
- Authenticated role intentionally retains broad EXECUTE/SELECT; access is enforced by RLS + role checks inside SECURITY DEFINER functions.
- Future scans should not reflag findings 2 and 4 unless a function/table is added that exposes data outside the existing role-check pattern.

### Step 4 — Mark findings as fixed / acknowledged

After the migration runs, call the security tool to mark findings 1 and 3 as fixed and 2/4 as ignored.

## What will NOT change

- No RLS policy is modified.
- No SECURITY DEFINER function body is modified.
- No table schema is modified.
- No edge function is modified.
- No frontend code is modified.
- All existing manager/planner/admin permissions, vacation flows, roster flows, profile visibility rules remain exactly as they are.

## Risk

Very low. Revoking anon is safe because the project has no anonymous code paths (Supabase auth is required throughout). The defensive re-grants to `authenticated` keep current behavior identical.
