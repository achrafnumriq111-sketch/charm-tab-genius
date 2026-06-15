# Project Memory

## Core
- **DOTTS** = product brand (kassasysteem). SAAKOUK = first tenant/customer. Never conflate.
- SaaS café platform, multi-tenant architecture.
- iPad/tablet optimized: 44px hit targets, viewport-fit=cover, responsive grid.
- Stack: Supabase (RLS anon access for PIN auth), Edge Functions, PassKit.
- AI BI powered exclusively by Apple WeatherKit (Europe/Amsterdam timezone).
- UI: Auros — abyssal observatory. Dark teal (#012624), Inter font, rationed teal→cyan gradients, no drop shadows. See [Auros theme tokens](mem://ui/auros-theme).
- Operations: "Anti-fuzz" strict logic. Ticket/cart state lifted to root.
- Business Hours: Mon-Thu 10-22, Fri-Sat 10-00, Sun 12-00.
- Customers: Name, Email, Phone strictly mandatory for all new entries.
- Multi-tenant: tenants → locations → employees. Subdomain per tenant.
- Platform admin: separate role via platform_admins table, /admin panel.

## Memories
- [Auros theme tokens](mem://ui/auros-theme) — Global dark teal abyssal theme, palette, gradients, fonts, radius
- [DOTTS brand](mem://brand/dotts) — Product brand DOTTS vs tenant SAAKOUK; what to rename and what not to touch
- [SaaS Tenant Model](mem://features/saas-tenant-model) — Tenants table, self-service onboarding, subdomain routing
- [Layout Design](mem://ui/layout-design) — Compact icon-centric sidebar, wrapping POS categories
- [State Management](mem://architecture/state-management) — Ticket/cart state keyed by table ID or walk-in
- [Order Attribution](mem://architecture/order-attribution) — Orders permanently stamped with active employee ID
- [Loyalty System](mem://features/loyalty-passkit) — PassKit integration and program ID
- [Transaction Persistence](mem://database/transaction-persistence) — POS sales storage, JSONB line items
- [Split Payments](mem://features/split-payments) — Split by method or person, independent calculation
- [Visual Floor Plan](mem://features/visual-floor-plan) — 2D editor, tables, statuses, virtual tables (Uber Eats)
- [Cash Closing System](mem://features/cash-closing-system) — Blind count, 4-eyes PIN verification, Owner Audit
- [Hardware Integration](mem://features/hardware-integration) — Epson ESC/POS cash drawer control via WebUSB
- [Profitability Costing](mem://features/profitability-costing) — Dynamic cost, Menu Engineering Matrix, simulation
- [VAT Configuration](mem://features/vat-configuration) — Dual-layer 9% food/drinks and 21% retail/other
- [Database RLS](mem://database/rls-policies) — Anonymous access patterns for QR and POS transactions
- [AI Weather Forecasting](mem://features/ai-weather-forecasting) — Apple WeatherKit BI engine and data sync
- [Inventory System](mem://features/inventory-system) — Master stock, dynamic perishables, waste, and counts
- [RBAC System](mem://auth/rbac-system) — 6-digit PIN login, team roles, and module navigation
- [Product Management](mem://features/product-management) — Creation, deletion, and owner notifications
- [Analytics Dashboard](mem://features/analytics-dashboard) — Reporting, KPIs, heatmaps, and accounting
- [QR Ordering](mem://features/qr-ordering) — Auto-accept, Kanban board, and mandatory customer data
- [Activity Logs](mem://features/activity-logs) — Audit logs and multi-criteria order history filtering
- [Prep Station KDS](mem://features/prep-station-kds) — Kitchen display routing, live timers, and statuses
- [Gift Cards](mem://features/gift-cards) — Post-sale issuance, PassKit coupling, DB persistence with RLS
- [Customers Registry](mem://features/customers) — Unified customers table, auto-upsert from POS/gift card/QR, RLS, backfilled
- [Modifiers System](mem://features/modifiers-system) — DB-driven modifier groups, options, product assignment, admin CRUD
- [Upsell Engine](mem://features/upsell-engine) — Smart rule-based upsell prompts with time windows and conversion tracking
- [Self-Service Onboarding](mem://features/onboarding) — Public signup, plan selection, 14-day trial subscription, demo data seeding
- [Reporting & Exports](mem://features/reporting-exports) — P&L per location, Moneybird/Exact/generic CSV download, VAT split
- [Loyalty 2.0](mem://features/loyalty-v2) — Tiers, customer segments, push/email/passkit campaigns
- [Marketplace Adapter Layer](mem://features/marketplace) — Uber Eats/Deliveroo/Thuisbezorgd + mock provider, menu sync, public webhook
- [Isolation Guards](mem://features/isolation-guards) — CI structural SQL + behavioral cross-tenant suites
