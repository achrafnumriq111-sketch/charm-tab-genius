## Audit — wat is NU al live vs wat niet

### Al in de database (✅ live)
- Customers, gift cards, employees, inventory items, POS transactions, cash closings, modifiers/groepen, upsell rules, QR orders, weather/forecast data, tenants, locations.
- Geen test/demo-rijen gevonden in de DB (alleen seed-arrays in code zijn al leeg: `initialProducts = []`, `initialCustomers = []`, `initialGiftCards = []`, `initialReservations = []`).

### NIET in de database — moet nog gefixt (❌)

| Domein | Huidige opslag | Probleem |
|---|---|---|
| **Producten** | `useState(initialProducts)` — alleen in geheugen | CRUD verdwijnt bij refresh, andere iPads zien niets, geen tenant-isolatie |
| **Floor plan: zones + tafels** | `localStorage` (`saakouk_zones`, `saakouk_tables`) + 8 hardcoded demo-tafels (T1, T2, Bar, 1-5) | Per browser/device anders, geen sync, demo-data bij eerste load |
| **Reservaties** | `useState` in memory | Weg bij refresh, niet zichtbaar voor collega's |
| **VAT-tarieven per categorie** | `localStorage` (`saakouk_vat_rates`) | Per device anders, fiscaal risico |
| **PassKit config** (programId, tierId, pointsPerEuro) | Hardcoded literal in `SaakoukPOS.tsx` regel 6093-6098 | Niet per tenant configureerbaar |
| **Feature flags lokaal** (tips, passkit, piggy, leat, qr, kitchen) | `useState({...true})` | Conflicteert met `tenant_feature_flags` tabel — moet daaruit komen |
| **Activity logs** (`addLog`) | `useState` — alleen in memory | Audit trail verdwijnt bij refresh; user vroeg eerder expliciet "waar zijn alle logs" |
| **Notifications / prep tickets** | `useState` | Verdwijnen bij refresh |
| **Discounts** | Hardcoded `discounts = [...]` regel 79-86 | Niet aanpasbaar |
| **Favoriete dashboard-insights** | `localStorage` | OK — pure UI-voorkeur per user, mag blijven |

### Plan: 4 nieuwe DB-tabellen + 3 uitbreidingen + opschoning

#### 1. Nieuwe tabellen (migratie)

```text
public.products            tenant+location-scoped, RLS (employee+) 
  - id, location_id, tenant_id, name, section, price, cost_price, vat_rate, color, tags[], is_active

public.floor_zones         location-scoped
  - id, location_id, name, sort_order, is_active

public.floor_tables        location-scoped (FK zone)
  - id, location_id, zone_id, name, seats, shape, x, y, w, h, is_active

public.reservations        location-scoped
  - id, location_id, guest_name, date, time, guests, table_id, phone, notes, status, employee_id

public.activity_logs       location-scoped, append-only
  - id, location_id, employee_id, employee_name, employee_role, action, details, metadata jsonb, created_at

public.discounts           location-scoped, CRUD
  - id, location_id, name, type(percent|amount), value, is_active

public.vat_category_rates  location-scoped
  - id, location_id, category, rate

public.location_settings   one row per location — passkit_program_id, passkit_tier_id, points_per_euro, auto_enrol, etc.
```

Elke `CREATE TABLE` krijgt: `GRANT` aan `authenticated` + `service_role`, RLS aan, en policies via bestaande helpers (`location_in_user_tenant`, `get_tenant_id_for_user`, `is_platform_admin`). Anon krijgt alleen `SELECT` op `products`/`discounts` waar dat al voor QR-menu nodig is.

Realtime aan voor: `products`, `reservations`, `floor_tables`, `floor_zones`, `activity_logs`.

#### 2. Code-aanpassingen in `src/components/SaakoukPOS.tsx`

- Producten: vervang `useState(initialProducts)` door fetch + realtime subscription op `products`, en `addProduct/updateProduct/deleteProduct` → INSERT/UPDATE/UPDATE is_active=false (geen hard delete, audit trail).
- Floor plan: verwijder de 8 demo-tafels en `initialZones`; lees uit DB; verwijder beide `localStorage.setItem`/`getItem` calls voor `saakouk_zones` + `saakouk_tables`; persist drag-positie als debounced UPDATE.
- Reservaties: vervang state door fetch + realtime; CRUD via DB.
- VAT-tarieven: vervang `localStorage` door fetch uit `vat_category_rates`; bij wijziging upsert in DB.
- PassKit-config: lezen uit `location_settings`; admin UI in Settings om aan te passen.
- Feature flags: gebruik bestaande `useFeatureFlags(tenantId)` hook in plaats van lokale `useState`.
- `addLog`: schrijft nu naar `activity_logs` (insert) én blijft in lokale state voor directe UI-update; `LogsView` leest uit DB.
- Discounts: vervang hardcoded array door fetch; admin UI in Products → Discounts tab.
- `generateId()` (`Math.random`) blijft alleen voor cart-items in het geheugen; alle DB-rijen krijgen `gen_random_uuid()` server-side.

#### 3. Backfill / migratie-data

- Geen backfill nodig — `initialProducts`, `initialCustomers`, `initialGiftCards`, `initialReservations` zijn al leeg.
- `initialTables` (8 demo) en `initialZones` (Binnen/Terras) worden NIET geseed. Eerste login krijgt lege floor plan met onboarding-tip "voeg je eerste zone toe".
- Bestaande VAT-defaults (9% food/drinks, 21% retail) worden via `location_settings` defaults bij tenant-onboarding ingevoegd in `setup_tenant_onboarding()` RPC.
- Bestaande `saakouk_vat_rates` / `saakouk_zones` / `saakouk_tables` localStorage entries: bij eerste login na deploy, eenmalig naar DB pushen als er nog niets in de DB staat (one-time migration helper in client), daarna localStorage key wissen.

#### 4. Opschoning

- Constanten die hardcoded blijven (mogen, dat zijn config defaults, geen data):
  - `SECTIONS`, `SECTION_COLORS`, `initialChannels` (Afhaal/Uber/Thuisbezorgd) — dit zijn UI-labels, geen "klantdata".
- Verwijderen: `initialTables`, `initialZones`, `initialProducts`, `initialCustomers`, `initialGiftCards`, `initialReservations`, hardcoded `discounts`, hardcoded `passkitConfig` literal.

#### 5. Verificatie na bouw

- Inloggen op 2 verschillende devices, product/tafel/reservatie toevoegen op device A → moet binnen 1s op device B verschijnen (realtime).
- Refresh: alle data blijft staan.
- Nieuwe tenant via `/signup`: krijgt lege omgeving, geen demo-data, met onboarding-tip.
- Logs-tab toont DB-records (incl. login + activity sinds deploy).
- DB linter: nul kritische findings na migratie.

### Wat blijft buiten scope (vraag terug aan jou)
- Audit-export naar CSV/PDF — apart vragen indien gewenst.
- Migratie van bestaande localStorage-data van productie-iPads die nu gebruikt worden (one-time importer in client opnemen — staat in stap 3, maar bevestig of dat nodig is of dat we volledig blanco starten).