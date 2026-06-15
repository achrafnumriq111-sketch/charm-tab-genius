---
name: Self-Service Onboarding
description: Public signup flow with plan selection, automatic tenant provisioning, 14-day trial subscription, and optional demo data seeding
type: feature
---

# Self-Service Onboarding (Fase 3 Blok 1)

## Flow
`/signup` → Account → Business → **Plan** → Done → `/app`

## Backend
- `setup_tenant_onboarding(_tenant_name, _slug, _owner_name, _city, _address, _timezone, _currency, _plan_type)` SECURITY DEFINER RPC:
  - Creates tenant + first location + owner employee
  - Creates a **trialing** subscription row (14-day trial, price 0) tied to the new location, so `SubscriptionGate` does not block new tenants
  - `_plan_type` accepts `trial` | `pro` | `scale` (enum `subscription_plan`)
- `seed_demo_data(_location_id)` SECURITY DEFINER RPC:
  - Inserts 10 demo products (matcha-themed, mixed VAT 9% / 21%) and a `Hoofdzaak` zone with 6 floor tables
  - Idempotent: skips if location already has products
  - Verifies caller via `location_in_user_tenant`

## Plan selection UI
Three cards: Gratis proef (€0), Pro (€49/mnd), Scale (€129/mnd). Default = trial. Stripe checkout is offered later via `/settings/billing` (Blok 4).

## Demo data toggle
Checkbox default ON. Owner can delete products and tables afterwards through normal admin UI.
