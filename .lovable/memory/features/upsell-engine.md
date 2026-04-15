---
name: Upsell Prompt Engine
description: Smart rule-based upsell suggestions triggered after item add, with time windows, conversion tracking, and admin CRUD
type: feature
---
- DB table: upsell_rules with trigger_product_id, trigger_category, suggested_product_id, time windows, priority, conversion/impression counters
- useUpsellEngine hook: loads rules, matches by product ID or category, checks time window, session-aware (no repeats, 5s rate limit)
- UpsellPrompt component: animated popup after item add with accept/dismiss
- UpsellRulesView admin: CRUD for rules, conversion stats, active/inactive toggle, time-of-day scheduling
- Session tracking: dismissed rules never re-shown, shown rules not repeated
- Anon read access for QR ordering
- Sidebar entry "Upsell" for manager/owner
