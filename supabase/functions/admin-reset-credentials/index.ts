// One-off admin tool: resets owner password + staff PINs, deletes orphaned auth users.
// Guarded by QA_GUARD_SECRET header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function randomPassword(len = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function randomPin() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = Deno.env.get("QA_GUARD_SECRET");
  if (!guard || req.headers.get("x-admin-secret") !== guard) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, srv);

  const out: Record<string, unknown> = { reset: [], deleted_auth_users: [], errors: [] };

  // 1. Get all SAAKOUK employees
  const { data: emps, error: empErr } = await admin
    .from("employees")
    .select("id, user_id, full_name, role, username_normalized, locations!inner(tenants!inner(slug))");
  if (empErr) return new Response(JSON.stringify({ error: empErr.message }), { status: 500, headers: corsHeaders });

  for (const emp of emps ?? []) {
    if (!emp.user_id) continue;
    const isOwner = emp.role === "owner";
    const newSecret = isOwner ? randomPassword(14) : randomPin();
    // update auth password
    const { error: updErr } = await admin.auth.admin.updateUserById(emp.user_id, { password: newSecret });
    if (updErr) {
      (out.errors as unknown[]).push({ employee: emp.full_name, error: updErr.message });
      continue;
    }
    // for staff, also hash the PIN into employees.pin_hash
    if (!isOwner) {
      const { error: hashErr } = await admin.rpc("exec_pin_hash_update" as never, {}).then(() => ({ error: null })).catch(() => ({ error: "rpc_missing" }));
      // direct sql via from() not allowed; use update with crypt expression via .rpc is overkill — use raw via admin client
      // Fall back: use a small INSERT/UPDATE round-trip via PostgREST: pgcrypto needs SQL. Use the .from with returning is not enough.
      // Solution: bcrypt via pure deno
      // Skip rpc; we hash here using bcrypt npm.
      void hashErr;
      const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
      const hash = await bcrypt.hash(newSecret);
      await admin.from("employees").update({ pin_hash: hash }).eq("id", emp.id);
    }
    (out.reset as unknown[]).push({
      name: emp.full_name,
      role: emp.role,
      username: emp.username_normalized,
      // deno-lint-ignore no-explicit-any
      tenant: (emp as any).locations?.tenants?.slug,
      new_credential: newSecret,
    });
  }

  // 2. Delete orphaned auth users (no employee + not platform admin, and from old test accounts)
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 200 });
  const validIds = new Set((emps ?? []).map((e) => e.user_id).filter(Boolean));
  const { data: padmins } = await admin.from("platform_admins").select("user_id");
  (padmins ?? []).forEach((p) => validIds.add(p.user_id));
  for (const u of users ?? []) {
    if (!validIds.has(u.id)) {
      // Keep only emails that look like test accounts; delete those.
      const e = u.email || "";
      if (
        e.endsWith("@pos.saakouk.internal") ||
        e === "aakouk94@hotmail.com" ||
        e === "saakoukstore@gmail.com" ||
        e.includes("qa-") ||
        e.includes("test")
      ) {
        const { error: dErr } = await admin.auth.admin.deleteUser(u.id);
        if (dErr) (out.errors as unknown[]).push({ user: e, error: dErr.message });
        else (out.deleted_auth_users as unknown[]).push(e);
      }
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
