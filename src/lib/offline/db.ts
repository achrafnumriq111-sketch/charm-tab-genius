/**
 * Offline IndexedDB store (Dexie).
 * - cache_*  : read-side replicas, keyed by id
 * - outbox   : pending mutations (UUID idempotency key)
 * - sync_meta: per-table watermark (last successful pull)
 */
import Dexie, { type Table } from "dexie";

export type OutboxStatus = "pending" | "in_flight" | "failed" | "dlq";

export interface OutboxEntry {
  id?: number;
  uuid: string; // idempotency key — generated client-side
  type:
    | "pos_transaction"
    | "cash_closing"
    | "stock_movement"
    | "qr_order"
    | "table_status";
  payload: Record<string, unknown>;
  tenant_id: string | null;
  location_id: string | null;
  employee_id: string | null;
  created_at: number;
  attempts: number;
  last_error?: string | null;
  status: OutboxStatus;
  next_attempt_at: number; // unix ms; respect backoff
}

export interface SyncMeta {
  table: string;
  last_synced_at: string; // ISO timestamp from server
  updated_at: number;
}

export interface CacheRow {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  tenant_id?: string | null;
  location_id?: string | null;
}

export class OfflineDB extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  sync_meta!: Table<SyncMeta, string>;
  // cache tables — uniform schema, queried per-table by name
  cache_products!: Table<CacheRow, string>;
  cache_modifier_groups!: Table<CacheRow, string>;
  cache_modifiers!: Table<CacheRow, string>;
  cache_floor_tables!: Table<CacheRow, string>;
  cache_floor_zones!: Table<CacheRow, string>;
  cache_employees!: Table<CacheRow, string>;
  cache_customers!: Table<CacheRow, string>;
  cache_discounts!: Table<CacheRow, string>;
  cache_inventory_items!: Table<CacheRow, string>;
  cache_vat_category_rates!: Table<CacheRow, string>;
  cache_location_settings!: Table<CacheRow, string>;

  constructor() {
    super("saakouk_offline_v1");
    this.version(1).stores({
      outbox: "++id, uuid, status, next_attempt_at, type, tenant_id",
      sync_meta: "table",
      cache_products: "id, updated_at, location_id",
      cache_modifier_groups: "id, updated_at, location_id",
      cache_modifiers: "id, updated_at",
      cache_floor_tables: "id, updated_at, location_id",
      cache_floor_zones: "id, updated_at, location_id",
      cache_employees: "id, updated_at, location_id",
      cache_customers: "id, updated_at, tenant_id",
      cache_discounts: "id, updated_at, location_id",
      cache_inventory_items: "id, updated_at, location_id",
      cache_vat_category_rates: "id, updated_at, location_id",
      cache_location_settings: "id, updated_at",
    });
  }
}

export const offlineDb = new OfflineDB();

export const CACHE_TABLES = [
  "products",
  "modifier_groups",
  "modifiers",
  "floor_tables",
  "floor_zones",
  "employees",
  "customers",
  "discounts",
  "inventory_items",
  "vat_category_rates",
  "location_settings",
] as const;

export type CacheTableName = (typeof CACHE_TABLES)[number];

export function cacheTable(name: CacheTableName): Table<CacheRow, string> {
  // @ts-expect-error dynamic table lookup is intentional
  return offlineDb[`cache_${name}`] as Table<CacheRow, string>;
}
