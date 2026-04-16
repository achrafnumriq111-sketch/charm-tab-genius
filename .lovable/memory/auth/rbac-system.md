---
name: RBAC System
description: Three roles (Owner, Manager, Sales) with configurable permissions per role per location
type: feature
---
- Three roles: Owner, Manager, Sales (enum: owner, manager, sales)
- Owner has all permissions always (cannot be unchecked)
- Manager defaults to all permissions, configurable by owner
- Sales defaults to limited permissions (POS, Orders, QR), configurable by owner
- Permissions stored in role_permissions table (role, permission_key, is_enabled, location_id)
- Permission keys: pos, orders, inventory, menu, modifiers, employees, analytics, cash_closing, floor_plan, qr_orders, forecast, upsell, logs, settings
- UI: "Rollen" button in Medewerkers view (owner only) opens permission matrix
- 6-digit PIN login, rate limiting, audit logging unchanged
