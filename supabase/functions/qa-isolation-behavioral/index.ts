// Behavioral cross-tenant isolation guard.
// Seeds two tenants + two locations + employees using service role, then
// signs in as each owner with anon-key sessions and verifies that RLS
// blocks every cross-tenant read/write attempt.
//
// Returns { ok: boolean, checks: [{ name, status, details? }] }.
// CI: invoke with the `x-qa-secret: $QA_GUARD_SECRET` header (must match
// the QA_GUARD_SECRET edge function secret). Non-2xx if any check fails.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Check = { name: string; status: "pass" | "fail"; details?: unknown };

function uniq() { return crypto.randomUUID().slice(0, 8); }

async function setupTenant(admin: ReturnType<typeof createClient>, label: string) {
  const id = uniq();
  const ownerEmail = `qa-owner-${label}-${id}@dotts.test`;
  const password = `Qa!${crypto.randomUUID()}`;

  const { data: userRes, error: userErr } = await (admin as any).auth.admin.createUser({
    email: ownerEmail, password, email_confirm: true,
  });
  if (userErr) throw new Error(`createUser: ${userErr.message}`);
  const ownerId = userRes.user.id;

  const { data: tenant, error: tErr } = await admin.from("tenants").insert({
    name: `QA ${label} ${id}`, slug: `qa-${label}-${id}`, owner_user_id: ownerId,
  }).select().single();
  if (tErr) throw new Error(`tenants insert: ${tErr.message}`);

  const { data: locs, error: lErr } = await admin.from("locations").insert([
    { name: `${label}-loc-1`, tenant_id: (tenant as any).id, timezone: "Europe/Amsterdam", currency: "EUR" },
    { name: `${label}-loc-2`, tenant_id: (tenant as any).id, timezone: "Europe/Amsterdam", currency: "EUR" },
  ]).select();
  if (lErr) throw new Error(`locations insert: ${lErr.message}`);

  const [loc1, loc2] = locs as any[];

  // Owner employee on loc1 (owners can cross-read inside same tenant via policy)
  const { error: eErr } = await admin.from("employees").insert({
    full_name: `Owner ${label}`, username_normalized: `owner${id}`, role: "owner",
    user_id: ownerId, location_id: loc1.id, is_active: true,
  });
  if (eErr) throw new Error(`employees insert owner: ${eErr.message}`);

  // Seed location-scoped fixtures on BOTH locations so cross-reads have rows to leak.
  await admin.from("products").insert([
    { name: `${label}-prod-1`, location_id: loc1.id, price: 1, vat_rate: 9, is_active: true },
    { name: `${label}-prod-2`, location_id: loc2.id, price: 1, vat_rate: 9, is_active: true },
  ]);

  const { data: zones } = await admin.from("floor_zones").insert([
    { name: `${label}-z1`, location_id: loc1.id, sort_order: 1 },
    { name: `${label}-z2`, location_id: loc2.id, sort_order: 1 },
  ]).select();
  const [z1, z2] = (zones ?? []) as any[];

  await admin.from("floor_tables").insert([
    { name: `${label}-t1`, zone_id: z1.id, location_id: loc1.id, seats: 2, x: 0, y: 0, w: 60, h: 60, shape: "round" },
    { name: `${label}-t2`, zone_id: z2.id, location_id: loc2.id, seats: 2, x: 0, y: 0, w: 60, h: 60, shape: "round" },
  ]);

  await admin.from("inventory_items").insert([
    { name: `${label}-inv-1`, unit: "g", location_id: loc1.id, tenant_id: (tenant as any).id, current_stock: 100, par_level: 50 },
    { name: `${label}-inv-2`, unit: "g", location_id: loc2.id, tenant_id: (tenant as any).id, current_stock: 100, par_level: 50 },
  ]);

  // Staff scoped to loc1 only — separate auth user
  const staffEmail = `qa-staff-${label}-${id}@dotts.test`;
  const { data: staffRes } = await (admin as any).auth.admin.createUser({
    email: staffEmail, password, email_confirm: true,
  });
  await admin.from("employees").insert({
    full_name: `Staff ${label}`, username_normalized: `staff${id}`, role: "staff",
    user_id: staffRes.user.id, location_id: loc1.id, is_active: true,
  });

  return {
    tenantId: (tenant as any).id, loc1Id: loc1.id, loc2Id: loc2.id,
    ownerEmail, staffEmail, password, ownerUserId: ownerId, staffUserId: staffRes.user.id,
  };
}

async function cleanup(admin: ReturnType<typeof createClient>, ids: { tenantIds: string[]; userIds: string[] }) {
  for (const t of ids.tenantIds) {
    await admin.from("tenants").delete().eq("id", t);
  }
  for (const u of ids.userIds) {
    try { await (admin as any).auth.admin.deleteUser(u); } catch { /* noop */ }
  }
}

function makeUserClient(token: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
}

async function signIn(email: string, password: string): Promise<string> {
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn ${email}: ${error?.message ?? "no session"}`);
  return data.session.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("QA_GUARD_SECRET");
  if (!expected || req.headers.get("x-qa-secret") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const checks: Check[] = [];

  try {
    const A = await setupTenant(admin, "A");
    const B = await setupTenant(admin, "B");
    tenantIds.push(A.tenantId, B.tenantId);
    userIds.push(A.ownerUserId, A.staffUserId, B.ownerUserId, B.staffUserId);

    const ownerAToken = await signIn(A.ownerEmail, A.password);
    const ownerBToken = await signIn(B.ownerEmail, B.password);
    const staffAToken = await signIn(A.staffEmail, A.password);

    const ownerA = makeUserClient(ownerAToken);
    const ownerB = makeUserClient(ownerBToken);
    const staffA = makeUserClient(staffAToken);

    // CHECK 1 — owner B cannot read tenant A products
    {
      const { data } = await ownerB.from("products").select("id,name").eq("location_id", A.loc1Id);
      const leaked = (data ?? []).length;
      checks.push({
        name: "owner_b_cannot_read_tenant_a_products",
        status: leaked === 0 ? "pass" : "fail",
        details: { leaked_rows: leaked },
      });
    }

    // CHECK 2 — owner B cannot insert into tenant A location
    {
      const { error } = await ownerB.from("products").insert({
        name: "leak-attempt", location_id: A.loc1Id, price: 1, vat_rate: 9, is_active: true,
      });
      checks.push({
        name: "owner_b_cannot_insert_into_tenant_a",
        status: error ? "pass" : "fail",
        details: { error_code: error?.code, error_message: error?.message },
      });
    }

    // CHECK 3 — owner B cannot update tenant A products
    {
      const { data, error } = await ownerB.from("products").update({ price: 999 })
        .eq("location_id", A.loc1Id).select();
      const mutated = (data ?? []).length;
      checks.push({
        name: "owner_b_cannot_update_tenant_a_products",
        status: mutated === 0 ? "pass" : "fail",
        details: { mutated_rows: mutated, error: error?.message },
      });
    }

    // CHECK 4 — owner B cannot read tenant A pos_transactions
    {
      const { data } = await ownerB.from("pos_transactions").select("id").eq("tenant_id", A.tenantId);
      checks.push({
        name: "owner_b_cannot_read_tenant_a_transactions",
        status: (data ?? []).length === 0 ? "pass" : "fail",
        details: { leaked_rows: (data ?? []).length },
      });
    }

    // CHECK 5 — owner B cannot read tenant A customers/segments/tiers
    for (const tbl of ["customers", "customer_segments", "loyalty_tiers", "marketplace_integrations"]) {
      const { data } = await (ownerB as any).from(tbl).select("id").eq("tenant_id", A.tenantId);
      checks.push({
        name: `owner_b_cannot_read_tenant_a_${tbl}`,
        status: (data ?? []).length === 0 ? "pass" : "fail",
        details: { leaked_rows: (data ?? []).length },
      });
    }

    // CHECK 6 — TWO LOCATIONS, SAME TENANT: staff at loc1 cannot read loc2 products
    {
      const { data } = await staffA.from("products").select("id,name").eq("location_id", A.loc2Id);
      checks.push({
        name: "staff_at_loc1_cannot_read_loc2_same_tenant",
        status: (data ?? []).length === 0 ? "pass" : "fail",
        details: { leaked_rows: (data ?? []).length },
      });
    }

    // CHECK 7 — staff cannot insert into loc2 (products)
    {
      const { error } = await staffA.from("products").insert({
        name: "cross-location-leak", location_id: A.loc2Id, price: 1, vat_rate: 9, is_active: true,
      });
      checks.push({
        name: "staff_at_loc1_cannot_insert_into_loc2",
        status: error ? "pass" : "fail",
        details: { error_code: error?.code },
      });
    }

    // CHECK 7b — staff cross-location READ blocked across all location-scoped tables
    const crossReadTables: Array<{ tbl: string; col?: string }> = [
      { tbl: "products" },
      { tbl: "floor_zones" },
      { tbl: "floor_tables" },
      { tbl: "inventory_items" },
      { tbl: "discounts" },
      { tbl: "location_settings" },
      { tbl: "vat_category_rates" },
      { tbl: "qr_orders" },
      { tbl: "pos_transactions" },
      { tbl: "cash_closings" },
    ];
    for (const { tbl } of crossReadTables) {
      const { data, error } = await (staffA as any).from(tbl).select("id").eq("location_id", A.loc2Id);
      const leaked = (data ?? []).length;
      checks.push({
        name: `staff_at_loc1_cannot_read_loc2_${tbl}`,
        status: leaked === 0 ? "pass" : "fail",
        details: { leaked_rows: leaked, error: error?.message },
      });
    }

    // CHECK 7c — staff cross-location INSERT blocked
    const crossInsertCases: Array<{ tbl: string; row: Record<string, unknown> }> = [
      { tbl: "products", row: { name: "x-leak", location_id: A.loc2Id, price: 1, vat_rate: 9, is_active: true } },
      { tbl: "floor_zones", row: { name: "x-leak", location_id: A.loc2Id, sort_order: 99 } },
      { tbl: "inventory_items", row: { name: "x-leak", unit: "g", location_id: A.loc2Id, tenant_id: A.tenantId, current_stock: 0, par_level: 0 } },
      { tbl: "discounts", row: { name: "x-leak", location_id: A.loc2Id, type: "percent", value: 5, is_active: true } },
      { tbl: "vat_category_rates", row: { category: "food", rate: 9, location_id: A.loc2Id } },
    ];
    for (const { tbl, row } of crossInsertCases) {
      const { error } = await (staffA as any).from(tbl).insert(row);
      checks.push({
        name: `staff_at_loc1_cannot_insert_into_loc2_${tbl}`,
        status: error ? "pass" : "fail",
        details: { error_code: error?.code, error_message: error?.message?.slice(0, 200) },
      });
    }

    // CHECK 7d — staff cross-location UPDATE blocked (try to bump a product price in loc2)
    {
      const { data, error } = await staffA.from("products").update({ price: 99 })
        .eq("location_id", A.loc2Id).select();
      const mutated = (data ?? []).length;
      checks.push({
        name: "staff_at_loc1_cannot_update_loc2_products",
        status: mutated === 0 ? "pass" : "fail",
        details: { mutated_rows: mutated, error: error?.message },
      });
    }

    // CHECK 8 — owner A SHOULD be able to read both own locations (positive control)
    {
      const { data } = await ownerA.from("products").select("id").in("location_id", [A.loc1Id, A.loc2Id]);
      checks.push({
        name: "owner_a_can_read_both_own_locations",
        status: (data ?? []).length >= 2 ? "pass" : "fail",
        details: { rows: (data ?? []).length },
      });
    }

    // CHECK 9 — neither owner is a platform admin
    {
      const { data } = await ownerB.from("platform_admins").select("user_id");
      // platform_admins has open SELECT — what matters is they are not in it
      const hits = (data ?? []).filter((r: any) => r.user_id === B.ownerUserId).length;
      checks.push({
        name: "tenant_owner_is_not_platform_admin",
        status: hits === 0 ? "pass" : "fail",
        details: { hits },
      });
    }

    const ok = checks.every((c) => c.status === "pass");
    await cleanup(admin, { tenantIds, userIds });

    return new Response(JSON.stringify({ ok, checks }, null, 2), {
      status: ok ? 200 : 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qa-isolation error", e);
    await cleanup(admin, { tenantIds, userIds });
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message), checks }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
