// QA: Cross-tenant isolation test suite (Phase 0 guard).
// Creates two ephemeral tenants + a multi-location tenant, then proves
// that no authenticated principal of tenant B can read/write tenant A's
// data, and that staff of location-1 cannot see location-2 within their
// own tenant. Cleans up on exit. Returns 200 on full pass, 500 on any
// assertion failure.
//
// Run with the platform owner's bearer token, or any authenticated user
// (creation uses service-role; assertions use freshly minted JWTs).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Assertion {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: Assertion[] = [];
function assert(name: string, cond: boolean, detail?: string) {
  results.push({ name, passed: cond, detail });
}

// Tables to probe for cross-tenant leakage. Each must be RLS-isolated.
const SCOPED_TABLES = [
  "pos_transactions",
  "products",
  "inventory_items",
  "customers",
  "qr_orders",
  "cash_closings",
  "stock_movements",
  "employees",
  "modifiers",
  "modifier_groups",
  "gift_cards",
  "floor_tables",
  "reservations",
  "discounts",
];

async function createTenant(admin: SupabaseClient, label: string) {
  const slug = `qa-${label}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `qa-owner-${label}-${crypto.randomUUID().slice(0, 8)}@qa.dotts.test`;
  const password = "QaTest!" + crypto.randomUUID().slice(0, 12);

  // 1. Create auth user
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !userRes.user) throw new Error(`createUser ${label}: ${userErr?.message}`);
  const userId = userRes.user.id;

  // 2. Create tenant
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({ name: `QA ${label}`, slug, owner_user_id: userId, is_active: true })
    .select("id, slug")
    .single();
  if (tErr || !tenant) throw new Error(`tenant ${label}: ${tErr?.message}`);

  // 3. Create primary location
  const { data: loc, error: lErr } = await admin
    .from("locations")
    .insert({ tenant_id: tenant.id, name: `QA ${label} L1`, city: "QA", timezone: "Europe/Amsterdam", currency: "EUR", is_active: true })
    .select("id")
    .single();
  if (lErr || !loc) throw new Error(`location ${label}: ${lErr?.message}`);

  // 4. Create owner employee
  const { error: eErr } = await admin
    .from("employees")
    .insert({
      user_id: userId,
      location_id: loc.id,
      full_name: `Owner ${label}`,
      username_normalized: `owner${label}`,
      role: "owner",
      is_active: true,
    });
  if (eErr) throw new Error(`owner employee ${label}: ${eErr.message}`);

  return { tenantId: tenant.id as string, locationId: loc.id as string, userId, email, password };
}

async function addLocation(admin: SupabaseClient, tenantId: string, label: string) {
  const { data: loc, error } = await admin
    .from("locations")
    .insert({ tenant_id: tenantId, name: label, city: "QA", timezone: "Europe/Amsterdam", currency: "EUR", is_active: true })
    .select("id")
    .single();
  if (error || !loc) throw new Error(`addLocation: ${error?.message}`);
  return loc.id as string;
}

async function addStaff(admin: SupabaseClient, locationId: string, label: string) {
  const email = `qa-staff-${label}-${crypto.randomUUID().slice(0, 8)}@qa.dotts.test`;
  const password = "QaStaff!" + crypto.randomUUID().slice(0, 12);
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr || !userRes.user) throw new Error(`staff user: ${userErr?.message}`);
  const userId = userRes.user.id;
  const { error: eErr } = await admin.from("employees").insert({
    user_id: userId, location_id: locationId, full_name: `Staff ${label}`,
    username_normalized: `staff${label}`, role: "staff", is_active: true,
  });
  if (eErr) throw new Error(`staff employee: ${eErr.message}`);
  return { userId, email, password };
}

async function seedRow(admin: SupabaseClient, table: string, locationId: string) {
  // Minimal viable payload per table so the row passes its column constraints.
  const base: Record<string, unknown> = { location_id: locationId };
  switch (table) {
    case "pos_transactions":
      Object.assign(base, {
        order_id: `qa-${crypto.randomUUID()}`,
        items: [], subtotal: 0, total: 0, payment_method: "cash",
        idempotency_key: crypto.randomUUID(),
      });
      break;
    case "products":
      Object.assign(base, { name: "QA Product", price: 1, vat_rate: 9 });
      break;
    case "inventory_items":
      Object.assign(base, { item_name: `QA Item ${crypto.randomUUID().slice(0,6)}`, category: "ingredient", unit_type: "g" });
      break;
    case "customers":
      Object.assign(base, { full_name: "QA Customer", source: "manual" });
      break;
    case "qr_orders":
      Object.assign(base, {
        table_id: `qa-table-${crypto.randomUUID().slice(0,6)}`,
        items: [], total: 0, status: "pending",
        idempotency_key: crypto.randomUUID(),
      });
      break;
    case "cash_closings":
      Object.assign(base, {
        primary_employee_id: "qa", primary_employee_name: "QA",
        second_checker_id: "qa2", second_checker_name: "QA2",
        envelope_code: `ENV-${crypto.randomUUID().slice(0,6)}`,
        counted_cash: 0, expected_cash_revenue: 0, difference: 0, status: "open",
        idempotency_key: crypto.randomUUID(),
      });
      break;
    case "stock_movements":
      {
        const { data: inv, error: iErr } = await admin.from("inventory_items")
          .insert({ location_id: locationId, item_name: `QA Inv mv ${crypto.randomUUID().slice(0,6)}`, category: "ingredient", unit_type: "g" })
          .select("id").single();
        if (iErr || !inv) throw new Error(`seed inv for movement: ${iErr?.message}`);
        Object.assign(base, {
          inventory_item_id: inv.id, movement_type: "manual_correction", quantity: 1,
          idempotency_key: crypto.randomUUID(),
        });
      }
      break;
    case "employees":
      {
        const { data } = await admin.from("employees").select("id").eq("location_id", locationId).limit(1).single();
        return data?.id as string;
      }
    case "modifier_groups":
      Object.assign(base, { name: `QA Group ${crypto.randomUUID().slice(0,8)}`, is_required: false });
      break;
    case "modifiers": {
      const { data: g, error: gErr } = await admin.from("modifier_groups")
        .insert({ location_id: locationId, name: `QA G ${crypto.randomUUID().slice(0,8)}`, is_required: false }).select("id").single();
      if (gErr || !g) throw new Error(`seed group for mod: ${gErr?.message}`);
      Object.assign(base, { group_id: g.id, name: "QA Mod", extra_price: 0, cost_price: 0 });
      break;
    }
    case "gift_cards":
      Object.assign(base, {
        code: `QA-${crypto.randomUUID().slice(0,8)}`,
        customer_name: "QA", customer_email: "qa@qa.test", customer_phone: "0",
        initial_value: 10, balance: 10, status: "active",
      });
      break;
    case "floor_tables": {
      const { data: z, error: zErr } = await admin.from("floor_zones")
        .insert({ location_id: locationId, name: `QA Zone ${crypto.randomUUID().slice(0,6)}` }).select("id").single();
      if (zErr || !z) throw new Error(`seed zone: ${zErr?.message}`);
      Object.assign(base, { zone_id: z.id, name: "QA T", seats: 2, shape: "square", x: 0, y: 0, w: 50, h: 50 });
      break;
    }
    case "reservations":
      Object.assign(base, {
        guest_name: "QA", guests: 2, status: "confirmed",
        reservation_date: new Date().toISOString().split("T")[0], reservation_time: "12:00",
      });
      break;
    case "discounts":
      Object.assign(base, { name: "QA Disc", discount_type: "percentage", value: 5 });
      break;
  }
  const { data, error } = await admin.from(table).insert(base).select("id").single();
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return data!.id as string;
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn failed: ${await res.text()}`);
  const j = await res.json();
  return j.access_token as string;
}

function userClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cleanup: Array<{ kind: "user"; id: string } | { kind: "tenant"; id: string }> = [];

  try {
    // ============ Setup ============
    const A = await createTenant(admin, "A");
    cleanup.push({ kind: "user", id: A.userId }, { kind: "tenant", id: A.tenantId });
    const B = await createTenant(admin, "B");
    cleanup.push({ kind: "user", id: B.userId }, { kind: "tenant", id: B.tenantId });

    // Add a 2nd location to A and staff scoped to A's primary location
    const A_loc2 = await addLocation(admin, A.tenantId, "QA A L2");
    const A_staff = await addStaff(admin, A.locationId, "A1");
    cleanup.push({ kind: "user", id: A_staff.userId });

    // Seed one row per scoped table in BOTH tenants (and one in A's L2)
    const seededA: Record<string, string> = {};
    const seededB: Record<string, string> = {};
    const seededA_L2: Record<string, string> = {};
    for (const t of SCOPED_TABLES) {
      try { seededA[t] = await seedRow(admin, t, A.locationId); } catch (e) { assert(`seed A.${t}`, false, String(e)); }
      try { seededB[t] = await seedRow(admin, t, B.locationId); } catch (e) { assert(`seed B.${t}`, false, String(e)); }
      try { seededA_L2[t] = await seedRow(admin, t, A_loc2); } catch (e) { assert(`seed A_L2.${t}`, false, String(e)); }
    }

    // ============ Cross-tenant isolation: B owner cannot see A data ============
    const jwtB = await signIn(B.email, B.password);
    const sbB = userClient(jwtB);

    for (const t of SCOPED_TABLES) {
      if (!seededA[t]) continue;
      const { data, error } = await sbB.from(t).select("id").eq("id", seededA[t]);
      assert(
        `B-owner cannot SELECT A.${t}`,
        !error && (data?.length ?? -1) === 0,
        error ? `err: ${error.message}` : `rows: ${data?.length}`,
      );

      // UPDATE: must affect 0 rows
      const upd = await sbB.from(t).update({ updated_at: new Date().toISOString() } as Record<string, unknown>).eq("id", seededA[t]).select("id");
      assert(
        `B-owner cannot UPDATE A.${t}`,
        !upd.error && (upd.data?.length ?? -1) === 0,
        upd.error ? `err: ${upd.error.message}` : `rows: ${upd.data?.length}`,
      );

      // DELETE: must affect 0 rows
      const del = await sbB.from(t).delete().eq("id", seededA[t]).select("id");
      assert(
        `B-owner cannot DELETE A.${t}`,
        !del.error && (del.data?.length ?? -1) === 0,
        del.error ? `err: ${del.error.message}` : `rows: ${del.data?.length}`,
      );
    }

    // ============ Intra-tenant isolation: A staff at L1 cannot see A.L2 data ============
    const jwtAStaff = await signIn(A_staff.email, A_staff.password);
    const sbAStaff = userClient(jwtAStaff);

    for (const t of SCOPED_TABLES) {
      if (!seededA_L2[t]) continue;
      const { data, error } = await sbAStaff.from(t).select("id").eq("id", seededA_L2[t]);
      assert(
        `A-staff(L1) cannot SELECT A.L2.${t}`,
        (data?.length ?? 0) === 0,
        error ? `err: ${error.message}` : `rows: ${data?.length}`,
      );
    }

    // ============ Positive control: A owner CAN see A's L1 data (sanity) ============
    const jwtA = await signIn(A.email, A.password);
    const sbA = userClient(jwtA);
    for (const t of SCOPED_TABLES) {
      if (!seededA[t]) continue;
      const { data, error } = await sbA.from(t).select("id").eq("id", seededA[t]);
      assert(
        `A-owner CAN SELECT A.L1.${t}`,
        (data?.length ?? 0) === 1,
        error ? `err: ${error.message}` : `rows: ${data?.length}`,
      );
    }

    // ============ Positive control: A owner CAN see A.L2 (cross-location within own tenant) ============
    for (const t of SCOPED_TABLES) {
      if (!seededA_L2[t]) continue;
      const { data, error } = await sbA.from(t).select("id").eq("id", seededA_L2[t]);
      assert(
        `A-owner CAN SELECT A.L2.${t}`,
        (data?.length ?? 0) === 1,
        error ? `err: ${error.message}` : `rows: ${data?.length}`,
      );
    }
  } catch (e) {
    assert("setup", false, e instanceof Error ? e.message : String(e));
  } finally {
    // Cleanup: delete tenants (cascades), then users
    for (const c of cleanup.reverse()) {
      try {
        if (c.kind === "tenant") await admin.from("tenants").delete().eq("id", c.id);
        if (c.kind === "user") await admin.auth.admin.deleteUser(c.id);
      } catch (_) { /* ignore cleanup errors */ }
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const status = failed.length === 0 ? 200 : 500;

  return new Response(
    JSON.stringify({
      ok: failed.length === 0,
      total,
      passed,
      failed: failed.length,
      failures: failed,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status },
  );
});
