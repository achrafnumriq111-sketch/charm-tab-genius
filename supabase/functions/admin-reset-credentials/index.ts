// One-off admin tool: resets owner passwords + staff PINs and deletes orphaned/test auth users.
// Guarded by QA_GUARD_SECRET header. Call once, then remove or leave behind a guarded endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function randomPassword(len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
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
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out: Record<string, unknown> = { reset: [], deleted_auth_users: [], errors: [] };

  const { data: emps, error: empErr } = await admin
    .from("employees")
    .select("id, user_id, full_name, role, username_normalized, locations!inner(tenants!inner(slug))");
  if (empErr) {
    return new Response(JSON.stringify({ error: empErr.message }), { status: 500, headers: corsHeaders });
  }

  for (const emp of emps ?? []) {
    if (!emp.user_id) continue;
    const isOwner = emp.role === "owner";
    // Auth password is ALWAYS a strong random secret (HIBP-safe).
    // For staff, the *real* credential is the 6-digit PIN stored as bcrypt(pin_hash).
    const authSecret = randomPassword(20);
    const userFacing = isOwner ? authSecret : randomPin();

    const { error: upErr } = await admin.auth.admin.updateUserById(emp.user_id, { password: authSecret });
    if (upErr) {
      (out.errors as unknown[]).push({ employee: emp.full_name, error: upErr.message });
      continue;
    }
    if (!isOwner) {
      const { error: pinErr } = await admin.rpc("set_employee_pin", { _employee_id: emp.id, _pin: userFacing });
      if (pinErr) {
        (out.errors as unknown[]).push({ employee: emp.full_name, error: pinErr.message });
        continue;
      }
    }
    (out.reset as unknown[]).push({
      name: emp.full_name,
      role: emp.role,
      username: emp.username_normalized,
      // deno-lint-ignore no-explicit-any
      tenant: (emp as any).locations?.tenants?.slug,
      credential: isOwner ? { type: "password", value: userFacing } : { type: "pin", value: userFacing },
    });
  }

  // Delete orphan/test auth users
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 200 });
  const keep = new Set((emps ?? []).map((e) => e.user_id).filter(Boolean));
  const { data: padmins } = await admin.from("platform_admins").select("user_id");
  (padmins ?? []).forEach((p) => keep.add(p.user_id));

  for (const u of users ?? []) {
    if (keep.has(u.id)) continue;
    const e = (u.email || "").toLowerCase();
    const looksTest =
      e.endsWith("@pos.saakouk.internal") ||
      e === "aakouk94@hotmail.com" ||
      e === "saakoukstore@gmail.com" ||
      e.includes("qa-") ||
      e.includes("test");
    if (!looksTest) continue;
    const { error: dErr } = await admin.auth.admin.deleteUser(u.id);
    if (dErr) (out.errors as unknown[]).push({ user: e, error: dErr.message });
    else (out.deleted_auth_users as unknown[]).push(e);
  }

  return new Response(JSON.stringify(out, null, 2), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
