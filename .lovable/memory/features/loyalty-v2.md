---
name: Loyalty 2.0
description: Tiered loyalty, customer segments, targeted campaigns (push/email/passkit)
type: feature
---

## Tables
- `loyalty_tiers` — per tenant; thresholds `min_total_spent`, `min_visit_count`; `point_multiplier`; `perks`; color
- `customer_segments` — per tenant; `definition` jsonb with keys: `min_total_spent`, `min_visits`, `days_since_last_visit_max`, `marketing_opt_in`, `tier_id`
- `loyalty_campaigns` — per tenant; `channel` push|email|passkit; `status` draft|scheduled|sending|sent|cancelled; `segment_id` optional

## RPCs
- `customer_current_tier(_customer_id)` → highest matching tier id
- `segment_match_query(_tenant_id, _definition)` → set of customer ids
- `segment_preview(_segment_id)` → `{ count, sample[10] }`

## UI
`/loyalty` page with Tabs: Tiers / Segmenten / Campagnes. Owner-only writes via RLS.

## TODO
- Wire campaign `send` action to passkit-loyalty edge function for actual push delivery
- Cron job to flip `scheduled` campaigns to `sending`/`sent` automatically
