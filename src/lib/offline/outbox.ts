/**
 * Outbox queue with UUID idempotency and exponential backoff.
 * Drained by SyncEngine; UI enqueues via enqueueMutation().
 */
import { offlineDb, type OutboxEntry } from "./db";

const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [0, 2_000, 5_000, 15_000, 60_000, 300_000]; // ~5 min cap

export function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
}

export interface EnqueueInput {
  type: OutboxEntry["type"];
  payload: Record<string, unknown>;
  tenant_id?: string | null;
  location_id?: string | null;
  employee_id?: string | null;
  uuid?: string;
}

export async function enqueueMutation(input: EnqueueInput): Promise<string> {
  const uuid = input.uuid ?? newUuid();
  // payload must carry the idempotency key for server-side dedupe
  const payload = { ...input.payload, idempotency_key: uuid };
  await offlineDb.outbox.add({
    uuid,
    type: input.type,
    payload,
    tenant_id: input.tenant_id ?? null,
    location_id: input.location_id ?? null,
    employee_id: input.employee_id ?? null,
    created_at: Date.now(),
    attempts: 0,
    status: "pending",
    next_attempt_at: Date.now(),
  });
  return uuid;
}

export async function pendingCount(): Promise<number> {
  return offlineDb.outbox.where("status").anyOf("pending", "failed").count();
}

export async function dueEntries(limit = 20): Promise<OutboxEntry[]> {
  const now = Date.now();
  return offlineDb.outbox
    .where("status")
    .anyOf("pending", "failed")
    .filter((e) => e.next_attempt_at <= now)
    .limit(limit)
    .toArray();
}

export async function markInFlight(id: number): Promise<void> {
  await offlineDb.outbox.update(id, { status: "in_flight" });
}

export async function markSuccess(id: number): Promise<void> {
  await offlineDb.outbox.delete(id);
}

export async function markFailure(
  id: number,
  attempts: number,
  err: string,
): Promise<void> {
  const next = attempts + 1;
  const dlq = next >= MAX_ATTEMPTS;
  const delay = BACKOFF_MS[Math.min(next, BACKOFF_MS.length - 1)];
  await offlineDb.outbox.update(id, {
    attempts: next,
    last_error: err.slice(0, 500),
    status: dlq ? "dlq" : "failed",
    next_attempt_at: Date.now() + delay,
  });
}

export async function listDLQ(): Promise<OutboxEntry[]> {
  return offlineDb.outbox.where("status").equals("dlq").toArray();
}

export async function resetDLQEntry(id: number): Promise<void> {
  await offlineDb.outbox.update(id, {
    status: "pending",
    attempts: 0,
    next_attempt_at: Date.now(),
  });
}
