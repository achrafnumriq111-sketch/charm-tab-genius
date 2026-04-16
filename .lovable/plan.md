

# Plan: Platform Admin UX Overhaul

Three changes to `src/pages/PlatformAdmin.tsx`:

## 1. Impersonation Log Overzicht

Add a new tab/section at the top of the admin page showing all entries from `admin_impersonation_log`. Columns: admin, tenant, start time, end time, duration (calculated). Sorted by most recent. Uses the existing table which already has RLS for platform admins.

## 2. Direct "Inloggen als tenant" (without PIN)

The "Bekijk als tenant" button already exists and calls the `admin-impersonate` edge function. Currently it redirects to `/?tenant=slug` — but the POS still requires PIN login via AuthContext. The fix:
- When impersonation data is stored in sessionStorage (`saakouk_impersonation`), the AuthContext/POS should detect this and bypass PIN login, using the employee data returned by the edge function directly.
- Update `src/contexts/AuthContext.tsx` to check for impersonation session on mount and auto-set the employee state.

## 3. Tenant-First Landing for Platform Admin

When a platform admin logs in and navigates to `/`, instead of showing the POS immediately, show a **tenant selector screen** first. This is a full-screen overlay/page listing all tenants with search. Clicking a tenant either:
- Opens their POS via impersonation, or
- Navigates to `/admin` with that tenant expanded.

Implementation: In `src/pages/Index.tsx` or `SaakoukPOS.tsx`, detect `isPlatformAdmin` from LocationContext. If true and no tenant is selected yet, render a tenant picker overlay instead of the POS.

## Technical Details

### Files to modify:
1. **`src/pages/PlatformAdmin.tsx`** — Add `ImpersonationLogTable` component fetching from `admin_impersonation_log`, render it as a collapsible section above the tenant list.

2. **`src/contexts/AuthContext.tsx`** — On mount, check `sessionStorage.getItem("saakouk_impersonation")`. If present, set employee state from stored data and skip PIN screen.

3. **`src/components/SaakoukPOS.tsx`** — When `isPlatformAdmin` is true and no `selectedTenantId` exists, render a tenant picker (cards with tenant name, plan badge, location count). Selecting a tenant calls `selectTenant()` from LocationContext and then triggers impersonation.

4. **`src/contexts/LocationContext.tsx`** — Minor: ensure `unlockTenant` is auto-called when impersonation session exists.

### No database changes needed
The `admin_impersonation_log` table already exists with the right columns and RLS policies.

