# Fase 0 — Isolatie-Hardening (DOTTS-niveau op huidige codebase)

Doel: structureel onmogelijk maken dat één tenant/locatie data van een ander kan lezen of muteren. Pas hierna gaan we Fase 1+ (subscriptions, Jarvis, multi-locatie UX) in.

## Wat we NIET doen
- Geen schone herbouw, geen project-reset. Bestaande SAAKOUK-data blijft staan.
- Geen UI-werk. Geen nieuwe features. Geen design-refresh.
- Subscriptions/Stripe (Fase 3) komt later — alleen de tabel-skeleton.

## De gaps (uit audit)

| Code | Gap | Aanpak |
|------|-----|--------|
| A | 20+ hot tables hebben `location_id` als NULLABLE | `SET NOT NULL` na backfill-check |
| B | Hot tables missen denormalized `tenant_id` | Kolom + FK + backfill + trigger om sync te houden |
| C | `employees` mist `tenant_id` + per-tenant unique index op username | Kolom + unique `(tenant_id, lower(username_normalized))` |
| D | `modifiers`, `gift_cards`, `role_permissions` missen `location_id` | Kolom toevoegen + backfill + RLS-policies herschrijven |
| E | `get_employee_role`, `location_in_user_tenant`, `is_platform_admin` niet REVOKE'd | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` |
| F | Geen cross-tenant isolatie-testsuite | Nieuwe edge function `qa-isolation-tests` |
| G | Geen `subscriptions`-tabel | Lege skeleton-tabel + RLS (gating komt in Fase 3) |

## Migratiestrategie

Eén grote migratie is te riskant. Ik split in **vier** migraties, in volgorde, elke afzonderlijk goed te keuren:

### Migratie 1 — Denormalized `tenant_id` op hot tables (additief, geen breuk)
Tabellen: `pos_transactions`, `products`, `inventory_items`, `customers`, `qr_orders`, `cash_closings`, `stock_movements`, `employees`.

Per tabel:
1. `ADD COLUMN tenant_id uuid REFERENCES public.tenants(id)` (nullable eerst)
2. Backfill: `UPDATE … SET tenant_id = locations.tenant_id FROM locations WHERE …`
3. `ALTER COLUMN tenant_id SET NOT NULL`
4. Index op `(tenant_id)` (en composite `(tenant_id, location_id)` waar zinvol)
5. Trigger `sync_tenant_id_from_location` BEFORE INSERT/UPDATE: zet `tenant_id` automatisch vanuit `location_id`. Voorkomt drift.
6. Voeg `tenant_id = get_tenant_id_for_user(auth.uid())` toe als **tweede** predicaat aan bestaande RLS-policies (defense in depth). Bestaande location-predicate blijft.

### Migratie 2 — `location_id NOT NULL` + ontbrekende kolommen
1. Voor elke tabel uit gap A: check 0 NULLs → `SET NOT NULL`. Faalt de check, laat ik je weten welke rows; we beslissen per geval (delete of locatie toewijzen).
2. Voor `modifiers`, `gift_cards`, `role_permissions`: `ADD COLUMN location_id uuid REFERENCES locations(id) NOT NULL` (na backfill via parent: `modifiers` → `modifier_groups.location_id`, `role_permissions` → reeds `location_id` per audit, dubbelcheck; `gift_cards` → vereist beslissing of ze tenant- of locatie-scoped zijn).
3. Schrijf RLS-policies voor die drie tabellen die ze nu missen.
4. `customers.location_id` blijft nullable (QR-anonymous insert pad), maar voeg `tenant_id NOT NULL` toe via migratie 1 zodat isolatie alsnog hard is.

### Migratie 3 — Per-tenant employee uniqueness + helper hardening
1. `CREATE UNIQUE INDEX employees_tenant_username_key ON employees (tenant_id, lower(username_normalized))` (na migratie 1 die `tenant_id` toevoegt).
2. Drop oude globale `idx_employees_username` (of behoud als niet-unique zoekindex).
3. `REVOKE EXECUTE ON FUNCTION get_employee_role, location_in_user_tenant, is_platform_admin FROM PUBLIC, anon, authenticated; GRANT … TO service_role;` — alleen aanroepbaar binnen RLS-expressies, niet via REST.

### Migratie 4 — `subscriptions` skeleton + helper
Per-locatie billing-tabel, niet actief gegated nog:
- Kolommen: `location_id`, `tenant_id`, `plan_type` ('all_in'|'custom'|'trial'), `status` ('trialing'|'active'|'past_due'|'suspended'|'canceled'), `price_cents`, `custom_overrides jsonb`, `current_period_end`, `stripe_subscription_id` (nullable, voor later).
- RLS: tenant-eigenaar leest eigen rows, service_role schrijft.
- Helper-functie `location_has_active_subscription(_location_id)` — bestaat maar wordt nog NIET ergens afgedwongen (komt in Fase 3).

## Cross-tenant testsuite (geen migratie)

Nieuwe edge function `qa-isolation-tests` die end-to-end bewijst:
1. **Setup**: maak tenant A (1 locatie + owner), tenant B (1 locatie + owner), en tenant A2 (zelfde owner als A maar 2e locatie + 1 staff aan locatie 1).
2. **Bewijs per scoped tabel** (pos_transactions, products, inventory_items, customers, qr_orders, cash_closings, stock_movements, employees, modifiers, gift_cards, floor_tables, reservations, discounts):
   - Insert 1 row in tenant A en 1 in tenant B.
   - Auth als owner B → SELECT/UPDATE/DELETE tenant A row moet 0 rows raken.
   - Auth als staff van locatie 1 → SELECT op locatie 2 (zelfde tenant) moet 0 rows.
3. **Cleanup**: harde teardown van alle testdata.
4. Faalt één assertion → exit 1 (zichtbaar in Jarvis security log).

Runnen via `supabase--test_edge_functions` of curl. Toevoegen aan dev-checklist (CI ontbreekt op Lovable, dus handmatig draaien voor elke schema-change).

## Volgorde van uitvoering

1. Migratie 1 voorstellen → jouw goedkeuring → draaien → verifiëren via `read_query` dat geen NULLs in `tenant_id`.
2. Migratie 2 idem (eerst NULL-check rapporteren als er pre-existing rows kapot zijn).
3. Migratie 3.
4. Migratie 4.
5. Edge function `qa-isolation-tests` schrijven + deployen + draaien. Resultaat tonen.
6. Korte changelog + memory-update.

Geschat: 4 migratie-rondes + 1 test-deploy. Elke migratie kun je los goed- of afkeuren.

## Risico's & mitigatie

- **NULL `location_id` rows die nu bestaan** → migratie 2 zal falen. Mitigatie: ik draai eerst een leesquery die per tabel het aantal NULL-rows rapporteert, dan beslissen we (orphan rows deleten of aan eerste locatie toewijzen).
- **RLS-policy break** door nieuwe `tenant_id`-predicate → ik voeg het toe als `AND`-clause naast bestaande check, dus restrictiever maar niet semantisch anders zolang `tenant_id` correct gesynct is via trigger.
- **Frontend-impact** → minimaal: nieuwe kolommen worden door de trigger automatisch gevuld, bestaande INSERTs hoeven `tenant_id` niet mee te sturen. Types-file regenereert na elke migratie.

## Definition of done voor Fase 0

- [ ] Alle hot tables: `location_id NOT NULL` + `tenant_id NOT NULL` + sync-trigger
- [ ] Alle RLS-policies op scoped tabellen hebben dubbele predicate (tenant + location)
- [ ] `modifiers`, `gift_cards`, `role_permissions` hebben RLS + location_id
- [ ] `employees` per-tenant unique op username
- [ ] Helper-functies REVOKE'd van anon/authenticated
- [ ] `subscriptions` skeleton aanwezig
- [ ] `qa-isolation-tests` draait groen voor minstens 12 scoped tabellen × 3 operaties
- [ ] Lovable-linter clean

Akkoord op deze aanpak? Dan begin ik met **Migratie 1** (denormalized `tenant_id` op hot tables) en rapporteer de backfill-resultaten voor we doorgaan.
