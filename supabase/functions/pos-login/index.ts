// Staff PIN login — STRICTLY device-gated.
// PIN is verified against employees.pin_hash (bcrypt).
// Session is minted via admin generateLink + verifyOtp, so the auth password
// is a strong random secret unrelated to the (necessarily weak) 6-digit PIN.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { username, pin, device_token } = await req.json();

    if (!username || typeof username !== "string" || !pin || typeof pin !== "string") {
      return json({ error: "Ongeldige inloggegevens" }, 400);
    }
    if (!/^\d{6}$/.test(pin)) return json({ error: "Ongeldige inloggegevens" }, 400);
    if (!device_token || typeof device_token !== "string") {
      return json({ error: "Dit apparaat is niet gekoppeld. Vraag de eigenaar om een koppelcode." }, 403);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, srv);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, " ");

    // Resolve device → tenant + location (server-trusted)
    const { data: device } = await admin
      .from("trusted_devices")
      .select("id, tenant_id, location_id, tenants:tenant_id(slug)")
      .eq("device_token", device_token)
      .is("revoked_at", null)
      .maybeSingle();

    if (!device) {
      await admin.from("security_events").insert({
        event_type: "invalid_device_token", severity: "warning", source: "edge:pos-login",
        ip_address: ip, user_agent: ua, metadata: { username: normalizedUsername },
      });
      return json({ error: "Apparaat niet (meer) gekoppeld" }, 403);
    }
    await admin.from("trusted_devices")
      .update({ last_seen_at: new Date().toISOString(), last_ip: ip, user_agent: ua })
      .eq("id", device.id);

    // Lookup employee — must be scoped to the device's location (anti-cross-location)
    const { data: employee } = await admin
      .from("employees")
      .select("*")
      .eq("username_normalized", normalizedUsername)
      .eq("location_id", device.location_id)
      .maybeSingle();

    if (!employee || !employee.is_active || !employee.user_id) {
      await admin.from("login_audit_logs").insert({
        employee_id: employee?.id ?? null, event_type: "login_failed",
        username_attempted: normalizedUsername, ip_address: ip, user_agent: ua,
        details: { reason: employee ? "inactive_or_no_user" : "not_found", device_id: device.id },
      });
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 200));
      return json({ error: "Ongeldige inloggegevens" }, 401);
    }

    if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(employee.locked_until).getTime() - Date.now()) / 60000);
      return json({ error: `Account vergrendeld. Probeer over ${remaining} min.` }, 429);
    }

    // Verify PIN via bcrypt (pin_hash). Staff without pin_hash cannot log in.
    if (!employee.pin_hash) {
      return json({ error: "PIN nog niet ingesteld. Vraag de eigenaar om je PIN te resetten." }, 401);
    }
    const { data: pinOk } = await admin.rpc("verify_employee_pin", { _employee_id: employee.id, _pin: pin });

    if (pinOk !== true) {
      const newAttempts = (employee.failed_login_attempts || 0) + 1;
      const upd: Record<string, unknown> = { failed_login_attempts: newAttempts };
      if (newAttempts >= MAX_ATTEMPTS) {
        upd.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
      }
      await admin.from("employees").update(upd).eq("id", employee.id);
      await admin.from("login_audit_logs").insert({
        employee_id: employee.id, event_type: "login_failed",
        username_attempted: normalizedUsername, ip_address: ip, user_agent: ua,
        details: { attempts: newAttempts, device_id: device.id },
      });
      return json({ error: "Ongeldige inloggegevens" }, 401);
    }

    // PIN valid → mint a session via magiclink token exchange.
    const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: mappedEmail,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("generateLink failed:", linkErr);
      return json({ error: "Sessie kon niet worden uitgegeven" }, 500);
    }

    const userClient = createClient(url, anon);
    const { data: verify, error: vErr } = await userClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });
    if (vErr || !verify?.session) {
      console.error("verifyOtp failed:", vErr);
      return json({ error: "Sessie kon niet worden uitgegeven" }, 500);
    }

    await admin.from("employees").update({
      failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(),
    }).eq("id", employee.id);

    await admin.from("login_audit_logs").insert({
      employee_id: employee.id, event_type: "login_success",
      username_attempted: normalizedUsername, ip_address: ip, user_agent: ua,
      details: { device_id: device.id },
    });

    return json({
      session: {
        access_token: verify.session.access_token,
        refresh_token: verify.session.refresh_token,
        expires_at: verify.session.expires_at ?? undefined,
      },
      employee: {
        id: employee.id, full_name: employee.full_name,
        role: employee.role, location_id: employee.location_id,
      },
      // deno-lint-ignore no-explicit-any
      tenant: { slug: (device as any).tenants?.slug ?? null },
      device: { id: device.id, location_id: device.location_id },
    });
  } catch (err) {
    console.error("staff-pin-login error:", err);
    return json({ error: "Er ging iets mis." }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
