

## Analyse van het huidige menu

Het zijbalk-menu heeft nu **24 items**. Een aantal zijn dubbel of horen logisch onder een ander module thuis. Hieronder de duidelijke duplicaten:

### Duplicaten / overbodig

| # | Knop | Probleem | Voorstel |
|---|------|----------|----------|
| 1 | **Waste** (top-level) | Bestaat al als tab `Verspilling` binnen **Voorraad** | Verwijderen uit zijbalk |
| 2 | **Telling** (stockcount) | Hoort logisch bij voorraad­beheer, nu losse knop | Toevoegen als tab in **Voorraad**, knop verwijderen |
| 3 | **Activity** vs **Logs** | Beide tonen audit-events. `Activity` = order­geschiedenis, `Logs` = klik­logs | Samenvoegen tot één **Logs** view met 2 tabs (Orders / Acties) |
| 4 | **Sales** vs **Accounting** | Sales = transactie­lijst, Accounting = BTW/omzet over zelfde data | Samenvoegen tot **Verkoop** met tabs (Transacties / Boekhouding) |
| 5 | **Kassa** (cashclose) vs **Audit** (cashaudit) | Kassasluiting + 4-eyes audit horen bij hetzelfde proces | Samenvoegen tot **Kassa** met tab "Audit" |
| 6 | **Mods** (modifiers) | Hoort bij productbeheer | Verplaatsen naar tab in **Products** |
| 7 | **Upsell** | Productregels — past bij Products | Verplaatsen naar tab in **Products** |
| 8 | **AI Forecast** vs **Dashboard** | Owner ziet beide — forecast is een widget, geen module | Integreren in **Dashboard** (tab of sectie) |

### Resultaat: 24 → 14 menu-items

```text
Owner / Admin                Staff
─────────────                ─────
Dashboard (incl. AI)         POS
Locaties                     Prep
POS                          Kassa
Prep                         Reservations
Kassa (incl. audit)          Customers
Reservations                 Gift cards
Products (incl. Mods+Upsell)
Voorraad (incl. Waste+Telling)
Marges
QR Ordering
Customers
Gift cards
Verkoop (Transacties+Boekhouding)
Logs (Orders+Acties)
Team
Settings
```

### Wat ik ga doen

1. **`Sidebar` `allSections` array inkorten** in `src/components/SaakoukPOS.tsx` (regel 222-247) — 8 items eruit.
2. **Voorraad-tabs uitbreiden** met `Telling` (regel 6722-6743) zodat `MonthlyCountView` daar binnenkomt.
3. **Products-view** een tab-laag geven met sub-tabs: Producten / Modifiers / Upsell.
4. **Verkoop-view** maken die `SalesView` + `AccountingView` als tabs combineert.
5. **Logs-view** uitbreiden naar tabs "Acties" (huidige `LogsView`) + "Orders" (huidige `ActivityView`).
6. **Kassa-view** uitbreiden met tab "Audit" (huidige `CashAuditView`).
7. **Dashboard** een sectie/tab "AI Forecast" geven die `AIForecastCenter` rendert.
8. **Backwards-compat**: in de router-switch bij `active === "waste"` etc. doorverwijzen naar de nieuwe locatie zodat oude bookmarks/links blijven werken.
9. **Activity logging** behouden (`view_changed` event) — niets gaat verloren in de audit trail.

Geen data­migraties nodig — alleen UI-herindeling. Alle bestaande componenten blijven bestaan, ze worden alleen onder een andere knop gemonteerd.

