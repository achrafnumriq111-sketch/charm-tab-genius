---
name: SaaS Tenant Model
description: Multi-tenant architecture with tenants table, self-service onboarding, subdomain routing, tenant-scoped RLS, feature flags, impersonation with PIN bypass, and tenant-first landing
type: feature
---
## Tenant Model
- `tenants` table: id, name, slug (unique, for subdomain), owner_user_id, is_active, plan
- `locations` has `tenant_id` FK to tenants
- Helper: `get_tenant_id_for_user(uid)` resolves tenant via employees → locations → tenants
- Helper: `location_in_user_tenant(location_id, user_id)` for tenant-scoped RLS
- Helper: `modifier_group_in_user_tenant(group_id, user_id)` for modifier tenant RLS
- Helper: `is_platform_admin(uid)` for platform admin checks
- Onboarding RPC: `setup_tenant_onboarding()` creates tenant + location + owner employee atomically

## Self-Service Onboarding
- `/signup` page: email/password → business details (name, slug, city, address) → done
- Slug auto-generated from business name, checked for availability
- After signup, user must verify email before login

## Subdomain Routing
- TenantContext detects slug from `{slug}.saakouk.app` hostname
- Dev mode: `?tenant=slug` query param
- QR menu: `{slug}.saakouk.app/menu/{table-id}`
- Login page shows tenant name dynamically
- LocationContext filters by tenant_id when on subdomain

## Platform Admin
- `platform_admins` table with `is_platform_admin()` helper
- `/admin` page: manage all tenants, activate/deactivate
- Separate from café owner role

## Feature Flags
- `tenant_feature_flags` table: tenant_id + feature_key + is_enabled
- 10 modules: pos, qr_ordering, upsell, loyalty, ai_forecast, inventory, prep_station, reservations, cash_closing, analytics
- Platform admins toggle per tenant in /admin panel
- `useFeatureFlags(tenantId)` hook for client-side conditional rendering
- Basis for pricing tiers (Free = limited features, Pro = all features)

## Impersonation
- `admin-impersonate` edge function: JWT-verified platform admin only
- "Bekijk als tenant" button in /admin panel + PlatformTenantPicker component
- AuthContext detects `saakouk_impersonation` in sessionStorage → auto-sets employee, bypasses PIN login
- LocationContext auto-unlocks tenant when impersonation session exists
- `admin_impersonation_log` table tracks all impersonation sessions (start/end, IP, UA)
- NOT logged in tenant's audit logs — platform-only visibility
- Collapsible ImpersonationLogTable in /admin shows all sessions with duration

## Tenant-First Landing (Platform Admin)
- When platform admin logs in and no tenant is selected, SaakoukPOS shows PlatformTenantPicker
- Full-screen overlay with search, tenant cards (name, slug, plan badge)
- Clicking a tenant triggers impersonation + auto-login
- "Naar Admin Dashboard" link to /admin

## Tenant Selector (Platform Admin Sidebar)
- Only visible to platform admins in POS sidebar
- PIN-gate: must re-verify own 6-digit PIN before switching tenant
- Session-only (not persistent across browser close)
- Filters locations by selected tenant

## RLS (Stap E - Hardened)
- All 22+ tables: dual isolation (tenant + location)
- Owner: sees all locations within OWN tenant only (not cross-tenant)
- Staff: sees own location only
- Platform admins: separate policies for cross-tenant access
- Anon: read active tenants (subdomain), QR orders (insert only), upsell rules (unchanged)
- pos-login edge function accepts optional `tenant_slug` for scoped login
