---
name: DOTTS brand vs SAAKOUK tenant
description: Product brand is DOTTS; SAAKOUK is a tenant/customer of DOTTS
type: design
---
The kassasysteem product is branded **DOTTS** in all marketing, login chrome, document titles, MFA labels, and product-level UI.

SAAKOUK is a specific tenant (customer) using DOTTS — Solaiman Aakouk is both owner and end-user. Keep "Saakouk" only where it refers to that tenant's business (e.g. receipt header for the SAAKOUK cafe, tenant.name fallbacks, internal email mapping `@pos.saakouk.internal`, existing `saakouk_*` localStorage keys).

Never rename: localStorage/sessionStorage keys (`saakouk_*`), Dexie DB name, internal email domain, hostname `.saakouk.app` detection — these are data/infra, renaming breaks sessions and tenants.
