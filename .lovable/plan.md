# Anti-fuzz SaaS hardening plan

Veel van wat je vraagt staat er al. Ik ga niets dubbel bouwen of slopen — eerst auditen, dan alleen de echte gaten dichten.

## Wat er al staat (niet opnieuw bouwen)

- **Tenants laag**: `tenants` (= companies), `locations`, `employees` (= company_users), `platform_admins`.
- **Helpers in DB**: `get_tenant_id_for_user`, `location_in_user_tenant`, `modifier_group_in_user_tenant`, `is_platform_admin`, `setup_tenant_onboarding`.
- **Auth**: 6-digit PIN login via `pos-login` edge function, Supabase Auth JWT, 30 min auto-logout, audit logs, HIBP, rate limiting + lockout.
- **Routing/context**: `TenantProvider` (subdomain slug), `AuthProvider`, `LocationProvider` met tenant-switch + PIN-unlock, `ProtectedRoute`.
- **Tenant-scoped RLS** op 40+ tabellen, realtime, GRANTs.
- **Onboarding**: `/signup` self-service, slug-check, atomic setup RPC.
- **Platform admin**: `/admin`, impersonation met audit log.
- **Live data**: products, floor plan, reservations, vat, discounts, activity logs etc. al in DB via `useLiveData`. Geen hardcoded testdata meer in POS.
- **RBAC**: rollen `owner/manager/sales` + `role_permissions` matrix per locatie (jouw eigen keuze, blijft zo — geen rename naar cashier/viewer want dat breekt enums, employees, edge functions en login).

## Fase 1 — Audit (read-only, geen code wijzigingen)

Ik lever een rapport met concrete bevindingen op deze punten:

1. **DB-scope check** (via `supabase--read_query` + `supabase--linter`):
   - Elke `public` tabel met business-data → heeft `tenant_id` of `location_id`?
   - RLS aan op elke tabel? Policy verwijst naar `get_tenant_id_for_user` / `location_in_user_tenant` / `has_role`?
   - GRANTs correct (geen onnodige `anon`-grants op user-data)?
   - Indexes op `tenant_id` / `location_id` / FK kolommen?
2. **Query-scope check** in `src/`:
   - `rg "supabase.from\("` → elke read/write heeft tenant- of location-filter (of vertrouwt op RLS én is daadwerkelijk gecovered).
   - `useLiveData` en alle hooks: filteren altijd op `locationId`?
   - Geen client-side role checks zonder server-side equivalent.
3. **Route guard check**:
   - `ProtectedRoute` checkt alleen `isAuthenticated`. Per-pagina rol-permissies komen uit `role_permissions` via sidebar → check of er routes/views zijn die de permission-gate omzeilen (deeplink, hash, URL-param).
4. **Session hygiëne**:
   - `logout()` wist `pos_employee`, impersonation key, `saakouk_active_location_id`, `saakouk_admin_selected_tenant`?
   - Bij removed/inactive employee: edge function `pos-login` blokkeert al → check ook lopende sessies (revoke pad).
5. **Cross-tenant pen-test queries** (read-only met service role): probeer als user A een row van tenant B te SELECTen — moet 0 rows geven.

Output: tabel met **bevinding → severity → fix in fase 2/3**.

## Fase 2 — DB-gaten dichten (alleen wat fase 1 vindt)

Per bevinding één migratie. Verwachte kandidaten op basis van wat ik nu zie:

- Eventueel ontbrekende `tenant_id` op tabellen die nu alleen `location_id` hebben → toegevoegd via FK, gevuld via `locations.tenant_id`, NOT NULL na backfill.
- Ontbrekende indexes op `(tenant_id)`, `(location_id)`, en samengestelde keys op hot queries (orders, transacties, activity_logs).
- RLS-policies strakker: SELECT/INSERT/UPDATE/DELETE expliciet gescheiden waar nu één `FOR ALL` policy staat met te brede `USING`.
- DELETE-rechten beperken tot `owner` via `has_role` (waar nog niet zo).
- Soft-delete kolom `deleted_at` toevoegen op kritieke tabellen (products, customers, orders) i.p.v. hard delete waar UI dat doet.

## Fase 3 — Frontend route-guard hardening

- Nieuwe `RoleGate` component: wraps view-render in `SaakoukPOS` switch en blokkeert op `role_permissions` server-side check (niet alleen sidebar-filter).
- `logout()` uitbreiden: wist álle `saakouk_*` / `pos_*` keys uit beide storages + `supabase.auth.signOut({ scope: 'local' })`.
- Bij elke mount van een view: `useLiveData` query faalt → toon "geen toegang" pagina i.p.v. lege UI.
- `LocationContext`: bij refetch checken of huidige `activeLocationId` nog in resultaat zit; zo niet → forceer reselect, geen stale id.

## Fase 4 — Public marketing site (nieuw, niet aanwezig)

Dit ontbreekt echt. Toevoegen onder dezelfde Vite-app, **alleen actief op platform-domein** (geen tenant-slug):

- `/` Home, `/features`, `/pricing`, `/contact`, `/demo`
- `TenantProvider.isPlatformLevel === true` → marketing routes mounten
- `isPlatformLevel === false` (subdomein) → huidige POS-app flow ongewijzigd
- CTA's linken naar `/signup` en `/login`
- Design: strak SaaS, consistent met huidige luxe pastel/glas stijl

## Fase 5 — Auth-flow aanvullen

- `/forgot-password` + `/reset-password` pagina's (Supabase `resetPasswordForEmail` + recovery handler) — voor **owners** (email/password). PIN-flow voor medewerkers blijft.
- `/accept-invite?token=…` pagina: owner nodigt employee uit via bestaande `employee-manage` edge function → invite mail → setup PIN.
- Geen wijziging aan `pos-login`/PIN-systeem.

## Fase 6 — QA matrix

Geautomatiseerd waar mogelijk, anders manueel script:

| Test | Verwacht |
|---|---|
| User tenant A query tenant B data | 0 rows |
| Sales-rol opent `/?view=settings` direct | RoleGate blokkeert |
| Sales-rol opent rapporten | Blokkeert |
| Manager wijzigt product | OK |
| Inactive employee login | 403 |
| Logout → terug-knop op /app | Redirect /login |
| Manipulatie `location_id` in insert payload | RLS reject |
| Nieuwe order/product/voorraad | `tenant_id` + `location_id` automatisch correct |

## Wat ik **niet** doe (en waarom)

- **Rollen hernoemen** naar cashier/viewer: enum `employee_role` is in gebruik door employees, edge functions, RLS policies en `role_permissions`. Jouw huidige `owner/manager/sales` dekt dezelfde scopes via de permission-matrix. Rename = high-risk, geen functionele winst.
- **`companies` tabel** los van `tenants`: identiek concept, dubbele tabel = bug-bron.
- **`profiles` tabel**: `employees` bevat al `full_name`, `role`, `user_id`. Aparte `profiles` voegt niks toe in deze app.
- **Globale rebuild van POS pagina's**: blijft intact, alleen `RoleGate` wrap + logout-fix.

## Volgorde & checkpoints

Na **elke fase**: app draait, geen regressies, korte status met diff.

1. Fase 1 audit-rapport → jij keurt prioriteit goed
2. Fase 2 DB migraties (één per bevinding, jij keurt elk goed)
3. Fase 3 frontend hardening
4. Fase 4 marketing site
5. Fase 5 password-reset + invite
6. Fase 6 QA-run + rapport

Akkoord op deze aanpak? Dan start ik fase 1 (read-only audit, geen risico).
