# Fase 6 — QA matrix run

Doel: bewijs leveren dat de hardening uit fase 1-5 echt werkt. Geen "het draait", maar een test-rapport per scenario uit de matrix in `.lovable/plan.md`.

## Aanpak

Twee sporen naast elkaar, want UI-tests dekken geen RLS en RLS-tests dekken geen route-guards:

1. **Server-side pen-test** via `supabase--read_query` met aparte JWT's per testgebruiker → bewijst tenant-isolatie op DB-niveau.
2. **Frontend RBAC + flow-test** via Vitest + Testing Library voor unit-niveau, en browser-tool voor 3 end-to-end smoke flows.

Eén rapport aan het eind: `QA-REPORT.md` in repo-root met per testcase status + bewijs (query output / screenshot / assertion).

## Test-matrix

| # | Test | Methode | Verwacht |
|---|---|---|---|
| 1 | User tenant A query tenant B `products` | SQL met JWT-A | 0 rows |
| 2 | User tenant A query tenant B `pos_transactions` | SQL met JWT-A | 0 rows |
| 3 | User tenant A query tenant B `customers` | SQL met JWT-A | 0 rows |
| 4 | User tenant A insert in tenant B `location_id` | SQL met JWT-A | RLS reject |
| 5 | Sales rol → `useRolePermissions.canAccessView('settings')` | Vitest | false |
| 6 | Sales rol → `canAccessView('analytics')` zonder grant | Vitest | false |
| 7 | Manager rol → `canAccessView('menu')` | Vitest | true |
| 8 | `RoleGate` blokkeert directe view-switch naar settings als sales | Vitest + RTL | "Geen toegang" UI |
| 9 | Inactive employee login via `pos-login` | curl edge function | 403 |
| 10 | Logout wist alle `saakouk_*` / `pos_*` storage keys | Vitest + jsdom | beide storages leeg |
| 11 | Login redirect na logout | browser-tool | `/login` |
| 12 | `LocationContext` met onbekende `activeLocationId` | Vitest | reset naar eerste valid |
| 13 | Nieuwe POS-order krijgt automatisch correct `tenant_id` | SQL insert + select | match user's tenant |
| 14 | Subdomain login (`?tenant=foo`) met user uit andere tenant | edge function call | 403 |
| 15 | Invite-accept met expired token | curl `invite-accept` | error "expired" |
| 16 | Marketing site bereikbaar op platform-level, niet op tenant-subdomein | route assertion | conditional render OK |

## Deliverables

1. **`scripts/qa/rls-pentest.ts`** — Deno/Node script dat met twee service-role-getekende JWTs (1 per test-tenant) elk SQL-scenario draait en JSON-output schrijft.
2. **Vitest suites**:
   - `src/hooks/useRolePermissions.test.ts` — cases 5/6/7
   - `src/contexts/AuthContext.test.tsx` — case 10
   - `src/contexts/LocationContext.test.tsx` — case 12
   - `src/components/RoleGate.test.tsx` — case 8 (component bestaat al in `SaakoukPOS` als inline guard; extracten naar losse `RoleGate` voor testbaarheid — minimale refactor, geen gedragsverandering).
3. **Edge function tests** via `supabase--test_edge_functions` voor cases 9, 14, 15.
4. **Browser-tool smoke** voor case 11 + visuele check van marketing site (case 16).
5. **`QA-REPORT.md`** — markdown tabel met per case: status (✅/❌), bewijs (output snippet of screenshot pad), eventueel fix-actie.

## Wat ik nodig heb van jou voordat ik start

- **Test-data**: mag ik 2 throwaway test-tenants aanmaken via `setup_tenant_onboarding` (slugs `qa-tenant-a`, `qa-tenant-b`) met elk 1 owner + 1 sales employee? Wordt aan het eind opgeruimd via DELETE-migratie.
- **Of**: heb je liever dat ik bestaande data gebruik en lees-only test? Dan vervallen cases 4 en 13 (insert-paden).

Geen code-wijzigingen behalve:
- Mini-refactor `RoleGate` extracten uit `SaakoukPOS` (pure verplaatsing, geen logica-wijziging).
- Nieuwe test-files (geen prod-code raakvlak).
- QA-script onder `scripts/qa/` (niet in prod-bundle).

## Volgorde

1. Jij keurt scope + test-data aanpak goed
2. Ik maak test-tenants + run RLS pentest
3. Vitest suites + edge function tests
4. Browser smoke
5. `QA-REPORT.md` opleveren
6. Cleanup test-tenants

## Out of scope (expliciet)

- Performance/load tests (ander traject)
- Penetration test op auth-flow zelf (Supabase eigen verantwoordelijkheid)
- Visuele regressie van bestaande POS views (niet aangeraakt sinds fase 3)
- Wijzigen van bestaande RLS-policies; fase 6 is bewijs, geen reparatie. Als een test faalt → bevinding in rapport, fix in losse vervolgactie.

Akkoord op deze aanpak + test-tenant strategie?
