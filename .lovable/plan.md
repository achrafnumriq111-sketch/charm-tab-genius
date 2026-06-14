
# Offline-First POS — Implementation Plan

Volledig offline-first met PWA service worker, IndexedDB cache (Dexie) en outbox queue met UUID idempotency. Last-write-wins sync.

## Architectuur

```text
┌─────────────────────────────────────────────────┐
│ React UI                                        │
│   ↓ reads/writes via offlineRepo (Dexie)        │
├─────────────────────────────────────────────────┤
│ Dexie (IndexedDB)                               │
│  • cache: products, modifiers, tables,          │
│    employees, customers, location_settings,     │
│    discounts, inventory_items, vat_rates        │
│  • outbox: pending mutations (UUID + payload)   │
│  • meta: last_sync_at per table                 │
├─────────────────────────────────────────────────┤
│ SyncEngine                                      │
│  • online detector (navigator.onLine + ping)    │
│  • pull: delta-sync via updated_at since meta   │
│  • push: drain outbox FIFO, retry w/ backoff    │
│  • BackgroundSync API + interval fallback       │
├─────────────────────────────────────────────────┤
│ Service Worker (vite-plugin-pwa, generateSW)    │
│  • app-shell NetworkFirst                       │
│  • Supabase REST: NetworkOnly (geen cache)      │
│  • assets CacheFirst                            │
└─────────────────────────────────────────────────┘
```

## Stappen (volgorde van uitvoering)

### 1. Foundation — PWA + Dexie skeleton
- `vite-plugin-pwa` met `generateSW`, `injectRegister: null`, `devOptions.enabled: false`
- Guarded registration wrapper (`src/lib/pwa/register.ts`) — refuse in Lovable preview/iframe/dev/`?sw=off`
- Manifest + icons (hergebruik bestaande SAAKOUK branding)
- Dexie schema (`src/lib/offline/db.ts`): tabellen `cache_*`, `outbox`, `sync_meta`
- Online-state hook `useOnlineStatus()` (ping `/rest/v1/` elke 30s, niet alleen `navigator.onLine`)

### 2. Cache layer — read-side
- `src/lib/offline/repo.ts` — `getProducts()`, `getTables()`, etc. die eerst Dexie lezen, dan in achtergrond verversen
- Initial bulk-load bij login: fetch alles van tenant, opslaan met `updated_at`
- Delta-sync: `SELECT * WHERE updated_at > sync_meta.last_sync_at`
- UI-componenten (POS, Menu, Floor, Employees) overschakelen op repo

### 3. Outbox — write-side
- Alle mutaties (orders, cash closings, stock movements, qr orders) gaan via `outbox.enqueue({type, uuid, payload})`
- UUID v4 client-generated; servers dedupen op `idempotency_key` kolom
- DB migratie: kolom `idempotency_key uuid unique` toevoegen aan `pos_transactions`, `cash_closings`, `stock_movements`, `qr_orders`
- Edge functions / inserts respecteren `ON CONFLICT (idempotency_key) DO NOTHING RETURNING`

### 4. Sync engine
- `SyncEngine.start()` bij login: registreert online/offline listeners + interval (10s)
- Push: drain outbox FIFO, op fail → exponential backoff, na 5 fails → DLQ-tabel in Dexie + toast aan manager
- Pull: per cache-tabel delta sinds laatste sync
- BackgroundSync API registratie waar beschikbaar (Chrome/Android); iPad Safari valt terug op interval

### 5. UI indicators
- Statusbalk in header: `Online` / `Offline · X pending` / `Syncing...`
- Per ticket badge "wacht op sync" zolang in outbox
- Settings-pagina `/admin/offline` met outbox-inhoud, force-sync knop, cache-reset knop

### 6. Conflict & edge cases
- Idempotency keys voorkomen dubbele orders na retry
- Cash drawer (WebUSB) blijft werken offline (lokaal hardware-commando)
- ESC/POS bonprinter blijft werken offline
- Auth: PIN-login moet offline kunnen → employee cache + lokale PIN-hash check (server her-valideert bij sync)
- Tafel-status: optimistic update lokaal, last-write-wins bij conflict (UI re-renders na pull)
- Reservations en QR orders: alleen lezen offline, schrijven blokkeren met duidelijke melding (te risicovol qua double-booking)

### 7. Testing
- Vitest: outbox enqueue/drain, dedupe, backoff
- Playwright/handmatig: Chrome DevTools → offline toggle, maak order, ga online, verifieer DB
- E2E: 2 iPads tegelijk offline → zelfde order UUID retry → 1 row in DB

### 8. Documentatie
- `OFFLINE-MODE.md`: wat werkt offline, wat niet, troubleshooting, force-reset procedure
- Memory entry `mem://features/offline-mode`

## Scope-grenzen (NIET in deze iteratie)
- Multi-device CRDT merge (alleen LWW)
- Offline analytics dashboard (alleen live)
- Offline AI weather forecasting (vereist WeatherKit live call)
- Offline PassKit uitgifte (vereist Apple servers)

## Geschatte oplevering
- Stap 1-2 (foundation + read cache): turn 1
- Stap 3-4 (outbox + sync): turn 2
- Stap 5-6 (UI + edge cases): turn 3
- Stap 7-8 (tests + docs): turn 4

Na akkoord start ik met stap 1.
