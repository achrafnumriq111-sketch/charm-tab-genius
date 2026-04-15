---
name: POS Authentication System
description: Secure PIN-based login with server-side verification, rate limiting, and audit logging
type: feature
---
- Login via gebruikersnaam (full_name) + 6-digit PIN
- Username mapped to internal email `{username}@pos.saakouk.internal` for Supabase Auth
- PIN hashed server-side by Supabase Auth (bcrypt) — never stored/exposed client-side
- Edge function `pos-login`: validates, checks lockout, authenticates, logs audit trail
- Edge function `pos-setup`: creates initial owner (requires POS_SETUP_SECRET)
- Rate limiting: 5 failed attempts → 15 min lockout
- Audit logging: login_audit_logs table (success, failed, lockout events)
- Session: Supabase Auth JWT, auto-logout after 30 min inactivity
- "Onthoud mij": localStorage vs sessionStorage for employee info
- Route protection: ProtectedRoute component, redirect to /login if unauthenticated
- employees table: full_name, username_normalized (unique CI), role enum (owner/manager/cashier/staff)
- RLS: owners manage employees, authenticated read, service role for edge functions
- SaakoukPOS uses useAuth() — no in-app employee picker. Auth employee auto-mapped to loggedInEmployee.
- Employee list loaded from database, not hardcoded.
- HIBP leaked password protection enabled.
