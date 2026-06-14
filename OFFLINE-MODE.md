# Offline Mode — SAAKOUK POS

## Wat werkt offline

| Module | Lezen | Schrijven |
| --- | --- | --- |
| POS — bestellingen | ✅ | ✅ buffert in outbox |
| Cash closing | ✅ | ✅ buffert in outbox |
| Voorraad-mutaties | ✅ | ✅ buffert in outbox |
| Tafel-status updates | ✅ | ✅ buffert in outbox |
| Producten / menu | ✅ cache | ❌ alleen online |
| Employees / RBAC | ✅ cache | ❌ alleen online |
| Klantenkaart | ✅ cache | ❌ alleen online (privacy) |
| Reservations | ✅ cache | ❌ double-booking risico |
| QR ordering (klant-kant) | ❌ vereist internet | ❌ |
| Analytics / AI weather | ❌ live data | ❌ |
| PassKit / loyalty issue | ❌ Apple servers | ❌ |
| Bonprinter & cash drawer | ✅ lokale WebUSB | ✅ lokale WebUSB |

## Architectuur

```
React UI ─► offlineRepo (Dexie) ─► IndexedDB
                                  ├─ cache_* (read replicas)
                                  ├─ outbox  (pending mutations, UUID-keyed)
                                  └─ sync_meta (per-table watermark)

SyncEngine
  • push: drains outbox FIFO, exponential backoff 0→2s→5s→15s→60s→5min, DLQ na 6 fails
  • pull: delta-sync per cache-tabel via updated_at > last_synced_at
  • online detector: navigator.onLine + 30s pull interval als heartbeat

Service Worker (vite-plugin-pwa, generateSW)
  • App-shell: NetworkFirst (4s timeout) → cache fallback
  • Supabase REST/Auth: NetworkOnly (nooit cachen)
  • JS/CSS: StaleWhileRevalidate
  • Images/fonts: CacheFirst (30 dagen)
```

## Idempotency

Elke schrijfactie krijgt een client-side UUID v4 die als `idempotency_key`
naar de server wordt gestuurd. Tabellen `pos_transactions`, `cash_closings`,
`stock_movements` en `qr_orders` hebben een unique partial index op deze kolom.
Retries na netwerk-flapping veroorzaken dus géén dubbele rijen.

## Conflict-strategie

**Last-write-wins.** Bij pull overschrijft de servertoestand de lokale cache.
Voor append-only tabellen (orders, closings, movements) is dit veilig dankzij
idempotency. Voor mutable state (tafel-status) accepteert de UI de
server-versie bij de volgende pull.

## Operationele procedures

### Force re-sync
Navigeer naar `/admin/offline` → "Pull nu" en "Push nu".

### Cache wissen (bij vermoeden van stale data)
`/admin/offline` → "Cache wissen". Dit leegt alle `cache_*` tabellen en
forceert een volledige bulk-pull. Outbox blijft intact.

### DLQ — handmatige interventie
Mutaties die 6 keer faalden komen in de DLQ. Eigenaar kan in
`/admin/offline` → "Opnieuw proberen" klikken. Bij structurele errors
(bv. RLS) eerst de oorzaak fixen, dan retry.

### Kill-switch service worker
`?sw=off` aan de URL toevoegen heft de SW-registratie op
(handig na een broken release).

## Niet ondersteund (bewust)

- Multi-device CRDT merge — alleen LWW
- Offline analytics dashboard — vereist live aggregates
- Offline AI weather forecasting — WeatherKit live call
- Offline PassKit uitgifte — Apple servers vereist
- PIN-validatie volledig lokaal — voor security blijft het na 24u verlopen offline-cache verplicht online opnieuw inloggen (TODO toekomstige iteratie)

## Browsers

| Platform | Status |
| --- | --- |
| iPad Safari 16+ | ✅ (geen BackgroundSync; interval-fallback werkt) |
| Chrome Android | ✅ (incl. BackgroundSync API) |
| Desktop Chrome / Edge | ✅ |
| Lovable preview iframe | ❌ SW bewust geblokkeerd (zie `src/lib/pwa/register.ts`) |

## Testing

```bash
bun run test src/lib/offline       # Vitest: outbox + dedupe
```

Handmatig: open in Chrome → DevTools → Network → "Offline" → maak order
→ vink "Online" → check `pos_transactions` in database.
