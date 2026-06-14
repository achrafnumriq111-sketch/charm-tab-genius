
# Auth Hardening — Tebi/Lightspeed-stijl multi-laag

Geen aparte URL per zaak (zoals `saakouk.app/cafe1`) — die laag bestaat al via tenant_id isolatie en is voor cross-tenant beveiliging niet nodig. In plaats daarvan: **QR Device Pairing + Trusted Devices + Owner MFA** toevoegen. Dit is exact het patroon van Tebi en Lightspeed.

## Wat er al staat (niet aanraken)
- Laag 1 — Owner login: email + wachtwoord (`loginOwner` in AuthContext) ✓
- Laag 2 — Tenant isolatie: `tenant_id` op alle tabellen + `get_tenant_id_for_user()` + RLS ✓
- Laag 4 — Medewerker PIN: 6-cijfer via `pos-login` edge function ✓
- Audit: `login_audit_logs` + `security_events` ✓

## Wat erbij komt

### Laag 3 — QR Device Pairing
Eigenaar opent op telefoon `/devices` → klikt "Nieuw apparaat koppelen" → server genereert eenmalige `pairing_code` (6 cijfers, 5 min geldig). iPad opent `/pair` → typt code → server stempelt iPad als `trusted_device` voor die tenant/locatie.

Nieuwe tabel `trusted_devices`:
- `device_token` (uuid, opgeslagen in localStorage op iPad)
- `tenant_id`, `location_id`, `device_name`, `last_seen_at`, `revoked_at`

Nieuwe tabel `device_pairing_codes`:
- `code` (6 digits), `tenant_id`, `location_id`, `created_by`, `expires_at`, `used_at`

Twee edge functions:
- `device-pair-start` (auth required, eigenaar/manager) → maakt code
- `device-pair-claim` (anon) → wisselt code voor `device_token`

### Laag 6 — Trusted Device flow
Login pagina checkt eerst `localStorage.saakouk_device_token`:
- **Trusted device** → toon alleen medewerkerslijst + PIN-pad (geen username typen, geen owner-tab)
- **Ongekoppelde browser/iPad** → toon huidige owner + employee tabs

`pos-login` krijgt optioneel `device_token` parameter. Edge function valideert device_token → tenant_id wordt server-side uit device gehaald i.p.v. subdomain → cross-tenant onmogelijk.

Nieuw scherm `/pair` (geen auth) voor ongekoppelde iPad.
Nieuw scherm `/devices` (owner/manager) om devices te bekijken/intrekken.

### Laag 5 — Owner MFA (TOTP)
Supabase Auth heeft native TOTP MFA. Aanzetten + UI:
- `/settings/security` voor eigenaar → "MFA inschakelen" → QR voor Google Authenticator → 6-cijfer challenge
- `loginOwner` flow uitbreiden: na `signInWithPassword` checken op `aal1` vs `aal2`; bij MFA-enrolled user → challenge scherm tonen
- Optioneel afdwingen voor rol `owner` via `mfa_required` flag

## Technische details

**Files (nieuw):**
- `supabase/migrations/...` — `trusted_devices`, `device_pairing_codes` + RLS + GRANTs
- `supabase/functions/device-pair-start/index.ts`
- `supabase/functions/device-pair-claim/index.ts`
- `src/pages/Pair.tsx` — 6-digit invoer voor iPad
- `src/pages/Devices.tsx` — beheer (owner/manager)
- `src/pages/MFASetup.tsx` — TOTP enrollment
- `src/lib/device.ts` — `getDeviceToken()`, `clearDeviceToken()`
- `src/components/MFAChallenge.tsx`

**Files (wijzigen):**
- `supabase/functions/pos-login/index.ts` — accepteer `device_token`, leid tenant af van device, log untrusted-device-attempts
- `src/contexts/AuthContext.tsx` — `loginOwner` MFA branch, device_token doorgeven aan PIN login
- `src/pages/Login.tsx` — trusted-device modus (alleen employee picker + PIN)
- `src/App.tsx` — routes `/pair`, `/devices`, `/settings/security`

**Security garanties:**
- `device_token` is per-device random UUID, ingetrokken bij verlies via `/devices`
- Pairing code: 6 digits + 5 min TTL + single-use → brute force window < 1000 pogingen
- PIN login zonder device_token blijft mogelijk (fallback), maar wordt gelogd als `untrusted_device_login`
- MFA optioneel per gebruiker, kan door platform admin afgedwongen worden via flag

## Buiten scope (bewust niet doen)
- Magic-link login (overlapt met email/password, voegt geen veiligheid toe)
- Eigen subdomain per tenant (`cafe1.saakouk.app/login`) — `tenant_id` isolatie + RLS dekt dit al af, en custom domain `cafepos.saakouk.nl` blijft één login URL zoals Tebi
- WebAuthn/passkeys (later, na TOTP)

## Volgorde van uitvoer
1. Migration: `trusted_devices` + `device_pairing_codes` + RLS
2. Edge functions: `device-pair-start`, `device-pair-claim`, update `pos-login`
3. UI: `/pair` (eenvoudig, eerst testen), dan `/devices`
4. AuthContext: trusted-device modus in Login
5. MFA: enrollment + challenge (los uit te brengen na 1-4)
