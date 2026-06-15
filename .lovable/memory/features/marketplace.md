---
name: Marketplace Adapter Layer
description: Uber Eats / Deliveroo / Thuisbezorgd integrations with mock provider, menu sync and incoming-order webhooks
type: feature
---

## Architecture
Provider-agnostic adapter pattern in `supabase/functions/_shared/marketplace.ts`.
Each provider implements `pushMenu`, `parseWebhook`, `updateOrderStatus`.
Real providers (uber_eats, deliveroo, thuisbezorgd) are stubs that mirror the mock — swap in real HTTP calls when OAuth secrets are available.

## Tables
- `marketplace_integrations` — per location+provider; status, credentials jsonb, webhook_secret, auto_accept
- `marketplace_orders` — normalized incoming orders, unique on (provider, external_order_id), can link to qr_orders / pos_transactions
- `marketplace_sync_log` — audit trail of menu_push / webhook_in / status_update events

## Edge Functions
- `marketplace-menu-sync` (JWT required) — pushes active products of the location to the provider
- `marketplace-webhook` (public, `verify_jwt = false`) — receives orders, verifies `x-marketplace-secret` header, upserts via adapter

## UI
`/marketplace` page — Tabs: Integrations / Inkomende orders.
"Trigger mock order" button hits the public webhook with sample payload for E2E testing.

## Webhook URL pattern
`<SUPABASE_URL>/functions/v1/marketplace-webhook?integration_id=<uuid>`
Header: `x-marketplace-secret: <integration.webhook_secret>`

## TODO when going live
- Replace stub adapters with real OAuth + HTTP per provider
- Surface marketplace_orders in KDS / Prep Station
- Map line items by `external_id` → internal `product_id` for accurate VAT split
