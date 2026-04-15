---
name: Modifier & Add-ons System
description: Database-driven modifier groups and options with CRUD admin, POS integration, and product assignment
type: feature
---
- Three DB tables: modifier_groups, modifiers, product_modifier_groups
- Admin page at sidebar key "modifiers" (admin/manager only)
- useModifiers hook loads all data and provides getGroupsForProduct(id) returning legacy-format groups
- enrichedProducts merges DB modifiers onto products, falling back to hardcoded modifierGroups
- ModifierPicker in POS uses the same legacy format (id, name, required, multiple, options[])
- Duplicate name validation on both group and modifier level
- Audit logging on all CRUD actions
- product_modifier_groups links product IDs to modifier group IDs
