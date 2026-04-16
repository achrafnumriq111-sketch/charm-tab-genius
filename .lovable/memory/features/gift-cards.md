---
name: Gift Cards System
description: DB-persisted gift cards with mandatory PassKit-style customer data and optional auto-enrolment
type: feature
---

# Gift Cards

- **Issuance**: Only post-sale via `PostSaleGiftCardModal` — never standalone.
- **Required fields**: forename, surname, email, phone, value (5–1000). Same as PassKit enrolment.
- **PassKit coupling**: Optional checkbox in modal — when checked, same customer data auto-enrols a PassKit member via `enrolMember()`. `passkit_member_id` and `passkit_enrolled` are stored on the gift card.
- **Persistence**: `public.gift_cards` table, location-scoped RLS (employees see/manage own location, owners see all tenant locations). No DELETE — audit trail only.
- **Realtime**: Postgres realtime channel `gift-cards-realtime` keeps state in sync across devices.
- **Redemption**: `handleRedeemGiftCard` updates `balance` + `status` ("active" → "redeemed" at 0). DB UPDATE persisted.
- **Logging**: Every step logged via `addLog` — offer_shown, offer_declined, form_started, value_selected, passkit_toggle, validation_failed, passkit_enrol_attempt/enrolled/failed, issued, persist_failed, redeemed, redeem_persist_failed.
- **Source traceability**: `source_order_id` links each card to the order that triggered issuance.
