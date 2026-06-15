---
name: Isolation Guard Suites
description: Two CI guards — structural SQL invariants RPC and behavioral cross-tenant edge function — ensure RLS, helpers, and tenant boundaries stay intact.
type: feature
---

# Isolation Guards (CI)

Implements the §4.2 / §13 non-negotiable of the DOTTS spec: every CI run proves
multi-tenant + multi-location isolation is enforced.

## Structural suite — `qa_structural_isolation_checks()` RPC
- Platform-admin / service-role only.
- Checks: RLS enabled on every public table, no wide-open `USING (true)` policies for non-service roles, required SECURITY DEFINER helpers exist, unique per-tenant employee username index, hot tables carry `tenant_id`.
- Allowlists are explicit constants inside the function so additions are reviewed.

## Behavioral suite — `qa-isolation-behavioral` edge function
- `verify_jwt = false`, gated by `x-qa-secret` header against `QA_GUARD_SECRET`.
- Service role seeds Tenant A (loc1+loc2, owner, staff scoped to loc1) and Tenant B (owner, staff). Then signs in as each user with the anon key and asserts:
  1. Owner B cannot read tenant A products / pos_transactions / customers / segments / loyalty_tiers / marketplace_integrations.
  2. Owner B cannot insert into nor update tenant A products.
  3. Staff at loc1 cannot read or insert into loc2 (same tenant).
  4. Owner A *can* read both own locations (positive control).
  5. Tenant owner is not silently a platform admin.
- Always cleans up tenants and auth users in `finally`.

## Runner & CI
- `scripts/qa-guards.mjs` calls both suites, prints `✓`/`✗` per check, exits non-zero on any failure.
- `.github/workflows/qa-isolation.yml` runs on PR + main + manual dispatch using repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QA_GUARD_SECRET`.

## How to extend
- Add a new structural check: append a `RETURN QUERY SELECT ...` block; keep allowlists narrow.
- Add a new behavioral check: push to the `checks[]` array; only `pass`/`fail` statuses are accepted by the runner.
