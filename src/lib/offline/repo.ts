/**
 * Offline repo — read API that prefers Dexie cache, falls back to network.
 * UI components can use these instead of direct supabase queries to gain
 * automatic offline support.
 */
import { supabase } from "@/integrations/supabase/client";
import { cacheTable, type CacheTableName } from "./db";

export async function cachedList<T = Record<string, unknown>>(
  name: CacheTableName,
  filter?: (row: T) => boolean,
): Promise<T[]> {
  const rows = await cacheTable(name).toArray();
  const list = rows.map((r) => r.data as T);
  return filter ? list.filter(filter) : list;
}

export async function cachedById<T = Record<string, unknown>>(
  name: CacheTableName,
  id: string,
): Promise<T | undefined> {
  const row = await cacheTable(name).get(id);
  return row?.data as T | undefined;
}

/** Force a one-shot fetch of a single table and write into cache. */
export async function refreshTable(name: CacheTableName): Promise<void> {
  const { data, error } = await supabase
    .from(name as never)
    .select("*")
    .limit(1000);
  if (error || !data) return;
  const table = cacheTable(name);
  const rows = (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    data: row,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    tenant_id: (row.tenant_id as string | undefined) ?? null,
    location_id: (row.location_id as string | undefined) ?? null,
  }));
  await table.clear();
  await table.bulkPut(rows);
}
