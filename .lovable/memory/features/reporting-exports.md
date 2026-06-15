---
name: Reporting & Accounting Exports
description: P&L per location with VAT split, Moneybird/Exact/generic CSV export of POS transactions
type: feature
---

# Reporting & Boekhoud-export (Fase 3 Blok 2)

## Backend
- `report_pnl(_location_id, _start, _end, _vat_rate)` SECURITY DEFINER RPC:
  - Aggregates `pos_transactions` (status=completed) over the window
  - Returns: gross/net revenue, VAT collected, discounts, tips, gift cards, avg order, payment split (cash/card/other), total collected, tx count
  - VAT calculation is **derived from the chosen rate** (9 / 21 / 0) — items currently don't carry per-line vat_rate so a single rate is applied uniformly. Owner picks the rate matching the period (e.g. 9% for food/drinks period).
- Edge function `accounting-export` (`?location_id&start&end&format=moneybird|exact|generic&vat_rate`):
  - Forwards caller's JWT to enforce RLS via standard supabase client
  - Streams CSV with one line per transaction
  - Moneybird: `date,description,amount,vat_percentage,contact`
  - Exact Online: `GLAccount,Date,Description,Amount,VATCode,Reference` (GL 8000, VATCode 1=high 2=low)
  - Generic: full detail incl. tip/discount/gift card

## Frontend `/reports`
- Date presets: Today / Yesterday / 7d / 30d / MTD / Custom
- VAT-rate selector (9 / 21 / 0)
- 8 stat cards: revenue, VAT, payment split, discounts, gift cards, avg order
- One-click download buttons for the three CSV formats
- Multi-location: switch via the global LocationContext switcher; cross-location aggregation is implicit (run per location)

## Not yet implemented
- Scheduled weekly email reports (requires email infra `setup_email_infra` to be deployed first)
- Per-line VAT split from items.jsonb (needs items normalization or product join)
