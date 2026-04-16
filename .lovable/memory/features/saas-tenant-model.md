---
name: SaaS Tenant Model
description: Multi-tenant architecture with tenants table, self-service onboarding, subdomain routing, and tenant-scoped RLS
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

## RLS (Stap E - Hardened)
- All 22+ tables: dual isolation (tenant + location)
- Owner: sees all locations within OWN tenant only (not cross-tenant)
- Staff: sees own location only
- Platform admins: separate policies for cross-tenant access
- Anon: read active tenants (subdomain), QR orders, upsell rules (unchanged)
- pos-login edge function accepts optional `tenant_slug` for scoped login
