---
name: SaaS Tenant Model
description: Multi-tenant architecture with tenants table, self-service onboarding, and subdomain routing
type: feature
---
## Tenant Model
- `tenants` table: id, name, slug (unique, for subdomain), owner_user_id, is_active, plan
- `locations` has `tenant_id` FK to tenants
- Helper: `get_tenant_id_for_user(uid)` resolves tenant via employees → locations → tenants
- Helper: `get_modifier_group_location(group_id)` for modifier RLS
- Onboarding RPC: `setup_tenant_onboarding()` creates tenant + location + owner employee atomically

## Self-Service Onboarding
- `/signup` page: email/password → business details (name, slug, city, address) → done
- Slug auto-generated from business name, checked for availability
- After signup, user must verify email before login

## Subdomain Routing (planned)
- Each tenant gets `{slug}.saakouk.app`
- QR menu: `{slug}.saakouk.app/menu/{table-id}`

## RLS
- Anon can read active tenants (subdomain resolution)
- Authenticated users can read own tenant
- Owner can update own tenant
- Insert: owner_user_id must match auth.uid()
