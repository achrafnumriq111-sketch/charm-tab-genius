---
name: Customers Registry
description: Unified public.customers table capturing every customer from POS, gift cards, QR orders, and PassKit
type: feature
---

# Customers

- **Table**: `public.customers` — single source of truth for every captured customer per location.
- **Fields**: full_name, email, phone, marketing_opt_in (default true), source (`gift_card`/`qr_order`/`pos`/`manual`/`passkit`), passkit_member_id, total_spent, visit_count, first_seen_at, last_seen_at, notes.
- **Uniqueness**: per location + lowercased email; fallback per location + phone when no email. No duplicates.
- **RLS**: location-scoped read/insert/update for employees; owners see all tenant locations. Anon can only insert with `source='qr_order'`. No DELETE (audit trail).
- **Auto-capture**: `upsertCustomer()` in `src/lib/customers.ts` is called from:
  - `handleOrderComplete` (POS sale with customer details) — adds `total` to spent, +1 visit
  - Gift card issuance `onIssue` — adds `initialValue` to spent, +1 visit, links `passkit_member_id` if enrolled
- **Realtime**: `customers-realtime` channel keeps in-memory `customers` state in sync.
- **CustomersView**: existing component now reads from DB-backed state instead of seed data.
- **Backfill**: existing qr_orders rows were aggregated and inserted on migration.
- **Logging**: `customer_upserted` / `customer_upsert_failed` via `addLog`.
- **Silent-fail prevention**: insert errors on gift cards and pos_transactions now show toasts (`⚠ ... niet opgeslagen: ...`).
