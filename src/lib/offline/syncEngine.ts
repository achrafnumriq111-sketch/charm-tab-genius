/**
 * SyncEngine — pulls cache deltas and pushes outbox mutations.
 * - push: drains outbox FIFO, retries with exponential backoff
 * - pull: per cache-table delta sync using updated_at watermark
 * - LWW conflict policy (server wins on pull; outbox always retries)
 */
import { supabase } from "@/integrations/supabase/client";
import {
  cacheTable,
  CACHE_TABLES,
  offlineDb,
  type CacheTableName,
} from "./db";
import { dueEntries, markFailure, markInFlight, markSuccess } from "./outbox";

const PULL_INTERVAL_MS = 30_000;
const PUSH_INTERVAL_MS = 5_000;

let timers: number[] = [];
let started = false;
let pushing = false;
let pulling = false;

type Listener = (status: SyncStatus) => void;
export interface SyncStatus {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: number | null;
}
const listeners = new Set<Listener>();
let current: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  syncing: false,
  lastError: null,
  lastSyncAt: null,
};

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

function emit(patch: Partial<SyncStatus>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
}

async function refreshPendingCount() {
  const n = await offlineDb.outbox
    .where("status")
    .anyOf("pending", "failed", "in_flight")
    .count();
  emit({ pendingCount: n });
}

/** Push pending mutations to the server. */
async function pushOnce(): Promise<void> {
  if (pushing || !current.online) return;
  pushing = true;
  emit({ syncing: true });
  try {
    const batch = await dueEntries(20);
    for (const entry of batch) {
      if (!entry.id) continue;
      await markInFlight(entry.id);
      try {
        await dispatchMutation(entry.type, entry.payload);
        await markSuccess(entry.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await markFailure(entry.id, entry.attempts, msg);
        emit({ lastError: msg });
      }
    }
  } finally {
    pushing = false;
    await refreshPendingCount();
    emit({ syncing: false });
  }
}

async function dispatchMutation(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Map outbox type → table. All inserts use idempotency_key for dedupe.
  const table = ({
    pos_transaction: "pos_transactions",
    cash_closing: "cash_closings",
    stock_movement: "stock_movements",
    qr_order: "qr_orders",
  } as Record<string, string>)[type];

  if (table) {
    const { error } = await supabase
      .from(table as never)
      .upsert(payload as never, {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      });
    if (error) throw error;
    return;
  }

  if (type === "table_status") {
    const { id, ...rest } = payload as { id: string; [k: string]: unknown };
    const { error } = await supabase
      .from("floor_tables")
      .update(rest as never)
      .eq("id", id);
    if (error) throw error;
    return;
  }

  throw new Error(`Unknown outbox type: ${type}`);
}

/** Pull cache deltas for all tracked tables. */
async function pullOnce(): Promise<void> {
  if (pulling || !current.online) return;
  pulling = true;
  emit({ syncing: true });
  try {
    for (const name of CACHE_TABLES) {
      await pullTable(name);
    }
    emit({ lastSyncAt: Date.now(), lastError: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ lastError: msg });
  } finally {
    pulling = false;
    emit({ syncing: false });
  }
}

async function pullTable(name: CacheTableName): Promise<void> {
  const meta = await offlineDb.sync_meta.get(name);
  const since = meta?.last_synced_at ?? "1970-01-01T00:00:00Z";

  const { data, error } = await supabase
    .from(name as never)
    .select("*")
    .gt("updated_at", since)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (error) {
    // Some tables may not be reachable for current user — skip silently
    return;
  }
  if (!data || data.length === 0) return;

  const table = cacheTable(name);
  const rows = (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    data: row,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    tenant_id: (row.tenant_id as string | undefined) ?? null,
    location_id: (row.location_id as string | undefined) ?? null,
  }));
  await table.bulkPut(rows);

  const newest = rows[rows.length - 1].updated_at;
  await offlineDb.sync_meta.put({
    table: name,
    last_synced_at: newest,
    updated_at: Date.now(),
  });
}

export function start(): void {
  if (started) return;
  started = true;

  const handleOnline = () => {
    emit({ online: true });
    void pushOnce();
    void pullOnce();
  };
  const handleOffline = () => emit({ online: false });

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Initial fetch
  void refreshPendingCount();
  void pullOnce();

  timers.push(
    window.setInterval(pushOnce, PUSH_INTERVAL_MS),
    window.setInterval(pullOnce, PULL_INTERVAL_MS),
    window.setInterval(refreshPendingCount, 2_000),
  );
}

export function stop(): void {
  timers.forEach((t) => clearInterval(t));
  timers = [];
  started = false;
}

export const syncEngine = {
  start,
  stop,
  subscribe,
  pushNow: pushOnce,
  pullNow: pullOnce,
};
