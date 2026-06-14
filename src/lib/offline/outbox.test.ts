import { describe, expect, it, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { offlineDb } from "./db";
import { enqueueMutation, pendingCount, newUuid } from "./outbox";

describe("offline outbox", () => {
  beforeEach(async () => {
    await offlineDb.outbox.clear();
  });

  it("generates a valid v4 UUID", () => {
    const id = newUuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("enqueues a mutation with idempotency key in payload", async () => {
    const uuid = await enqueueMutation({
      type: "pos_transaction",
      payload: { total: 4.5 },
    });
    const all = await offlineDb.outbox.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].uuid).toBe(uuid);
    expect(all[0].payload.idempotency_key).toBe(uuid);
    expect(all[0].status).toBe("pending");
  });

  it("preserves caller-supplied UUID for retry idempotency", async () => {
    const uuid = newUuid();
    await enqueueMutation({ type: "cash_closing", payload: {}, uuid });
    await enqueueMutation({ type: "cash_closing", payload: {}, uuid });
    // Both rows kept in outbox, but they share the same UUID so the server
    // will dedupe via the unique idempotency_key index.
    const rows = await offlineDb.outbox.where("uuid").equals(uuid).toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0].uuid).toBe(rows[1].uuid);
  });

  it("counts pending entries", async () => {
    await enqueueMutation({ type: "stock_movement", payload: {} });
    await enqueueMutation({ type: "stock_movement", payload: {} });
    expect(await pendingCount()).toBe(2);
  });
});
