---
name: Billing & Subscription Gating
description: Stripe-backed subscription gating, trial/past_due/suspended flows, owner billing page
type: feature
---
- Subscriptions table keyed by location_id+tenant_id; statuses: trialing, active, past_due, suspended, canceled.
- plan_type enum: all_in/custom/trial; all paid Stripe plans map to 'all_in'.
- Stripe products: saakouk_pro (€49/mo, €490/yr) and saakouk_scale (€129/mo, €1290/yr). 14-day trial via subscription_data.trial_period_days.
- Edge functions: payments-webhook (?env=sandbox|live) syncs customer.subscription.* and invoice.payment_failed → past_due; create-checkout (embedded ui_mode); create-portal-session.
- All payment functions have verify_jwt=false in config.toml; in-code auth via supabase.auth.getUser.
- SubscriptionGate wraps Index route: trialing→amber banner with days left, past_due→red sticky banner, suspended/canceled-expired→full blocker. Always exempts /settings/billing.
- Owner billing page at /settings/billing; embedded checkout at /settings/billing/checkout via sessionStorage clientSecret handoff.
- Jarvis subscriptions overview: MRR (yearly /12), active/trialing/past_due counts, 30d churn, past_due tenant list.
