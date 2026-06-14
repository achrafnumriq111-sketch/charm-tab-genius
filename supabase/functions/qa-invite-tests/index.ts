// QA E2E — Invite flow tests (kept around for CI).
// Self-contained: creates a throwaway tenant/owner/location, exercises the
// complete invite lifecycle (info/accept/reuse/expired/malformed/revoke),
// and cleans up. Safe to call against any Supabase project — only touches
// rows it created.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaseResult {
  case: string;
  expected: string;
  actual: string;
  pass: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey);

  const results: CaseResult[] = [];
  const stamp = Date.now();
  const slug = `qa-inv-${stamp}`;
  const ownerEmail = `qa-inv-owner-${stamp}@qa.saakouk.test`;
  const ownerPwd = "QaTest!Pass123";
  const inviteeName = `QA Invitee ${stamp}`;
  const inviteePin = "654321";

  let tenantId: string | null = null;
  let locationId: string | null = null;
  let ownerUserId: string | null = null;
  let validInviteId: string | null = null;
  let validToken: string | null = null;
  let inviteeUserId: string | null = null;

  const push = (c: CaseResult) => results.push(c);

  const callInviteAccept = (action: string, token: string, extra: Record<string, unknown> = {}) =>
    fetch(`${url}/functions/v1/invite-accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ action, token, ...extra }),
    });

  const callInviteCreate = (jwt: string, body: Record<string, unknown>) =>
    fetch(`${url}/functions/v1/employee-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    });

  try {
    // ── Setup: owner + tenant + location ─────────────────────────
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: ownerEmail, password: ownerPwd, email_confirm: true,
    });
    if (userErr || !userData.user) throw new Error(`createUser: ${userErr?.message}`);
    ownerUserId = userData.user.id;

    const client = createClient(url, anonKey);
    const { data: sess, error: sErr } = await client.auth.signInWithPassword({
      email: ownerEmail, password: ownerPwd,
    });
    if (sErr || !sess.session) throw new Error(`signIn: ${sErr?.message}`);
    const ownerJwt = sess.session.access_token;

    const { data: setup, error: setupErr } = await client.rpc("setup_tenant_onboarding", {
      _tenant_name: `QA Invite Co ${stamp}`,
      _slug: slug,
      _owner_name: `QA Inv Owner ${stamp}`,
      _city: "QA", _address: "QA",
      _timezone: "Europe/Amsterdam", _currency: "EUR",
    });
    if (setupErr) throw new Error(`onboarding: ${setupErr.message}`);
    tenantId = (setup as { tenant_id: string }).tenant_id;
    locationId = (setup as { location_id: string }).location_id;

    // ── CASE I1: owner creates an invite via employee-invite ─────
    {
      const r = await callInviteCreate(ownerJwt, {
        action: "create", full_name: inviteeName, role: "sales", location_id: locationId,
      });
      const body = await r.json().catch(() => ({}));
      const ok = r.status === 201 && !!body?.invite?.token;
      if (ok) {
        validInviteId = body.invite.id;
        validToken = body.invite.token;
      }
      push({
        case: "I1. employee-invite create as owner",
        expected: "201 + token returned",
        actual: `status ${r.status} — token=${body?.invite?.token ? "present" : "missing"}`,
        pass: ok,
      });
    }

    // ── CASE I2: invite-accept info with valid token ─────────────
    if (validToken) {
      const r = await callInviteAccept("info", validToken);
      const body = await r.json().catch(() => ({}));
      push({
        case: "I2. invite-accept info on valid token",
        expected: "200 + full_name match",
        actual: `status ${r.status} — full_name=${body?.full_name || "missing"}`,
        pass: r.status === 200 && body?.full_name === inviteeName,
      });
    }

    // ── CASE I3: invite-accept with malformed PIN ────────────────
    if (validToken) {
      const r = await callInviteAccept("accept", validToken, { pin: "12" });
      const body = await r.json().catch(() => ({}));
      push({
        case: "I3. invite-accept reject malformed PIN",
        expected: "400 + 'PIN moet exact 6 cijfers zijn'",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 400 && String(body?.error || "").includes("6 cijfers"),
      });
    }

    // ── CASE I4: invite-accept accept with valid token + PIN ─────
    if (validToken) {
      const r = await callInviteAccept("accept", validToken, { pin: inviteePin });
      const body = await r.json().catch(() => ({}));
      const ok = r.status === 200 && body?.success === true && body?.full_name === inviteeName;
      // Capture created auth user id for cleanup
      if (ok) {
        const { data: u } = await admin
          .from("employees").select("user_id")
          .eq("full_name", inviteeName).maybeSingle();
        inviteeUserId = (u as { user_id: string } | null)?.user_id || null;
      }
      push({
        case: "I4. invite-accept accept with valid token",
        expected: "200 + success + employee created",
        actual: `status ${r.status} — success=${body?.success}`,
        pass: ok,
      });
    }

    // ── CASE I5: token re-use blocked (already accepted) ─────────
    if (validToken) {
      const r = await callInviteAccept("accept", validToken, { pin: "111111" });
      const body = await r.json().catch(() => ({}));
      push({
        case: "I5. invite-accept reuse already-accepted token",
        expected: "410 + 'al gebruikt'",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 410 && String(body?.error || "").toLowerCase().includes("al gebruikt"),
      });
    }

    // ── CASE I6: info on already-accepted token also blocked ─────
    if (validToken) {
      const r = await callInviteAccept("info", validToken);
      const body = await r.json().catch(() => ({}));
      push({
        case: "I6. invite-accept info on used token",
        expected: "410 + 'al gebruikt'",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 410 && String(body?.error || "").toLowerCase().includes("al gebruikt"),
      });
    }

    // ── CASE I7: expired token (info) ───────────────────────────
    const expiredToken = `qa-exp-${stamp}-${crypto.randomUUID().slice(0, 8)}`;
    await admin.from("employee_invites").insert({
      token: expiredToken,
      full_name: `QA Expired ${stamp}`,
      role: "sales",
      location_id: locationId!,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      invited_by: ownerUserId!,
    });
    {
      const r = await callInviteAccept("info", expiredToken);
      const body = await r.json().catch(() => ({}));
      push({
        case: "I7. invite-accept info on expired token",
        expected: "410 + 'verlopen'",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 410 && String(body?.error || "").toLowerCase().includes("verlopen"),
      });
    }

    // ── CASE I8: expired token (accept) ─────────────────────────
    {
      const r = await callInviteAccept("accept", expiredToken, { pin: "999999" });
      const body = await r.json().catch(() => ({}));
      push({
        case: "I8. invite-accept accept on expired token",
        expected: "410 + 'verlopen'",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 410 && String(body?.error || "").toLowerCase().includes("verlopen"),
      });
    }

    // ── CASE I9: unknown token ──────────────────────────────────
    {
      const r = await callInviteAccept("info", "deadbeef-not-real-token");
      const body = await r.json().catch(() => ({}));
      push({
        case: "I9. invite-accept on unknown token",
        expected: "404",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 404,
      });
    }

    // ── CASE I10: empty/missing token ───────────────────────────
    {
      const r = await fetch(`${url}/functions/v1/invite-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ action: "info", token: "" }),
      });
      const body = await r.json().catch(() => ({}));
      push({
        case: "I10. invite-accept rejects empty token",
        expected: "400",
        actual: `status ${r.status} — ${body?.error || ""}`,
        pass: r.status === 400,
      });
    }

    // ── CASE I11: revoke flow ───────────────────────────────────
    if (ownerJwt) {
      // create then revoke
      const c = await callInviteCreate(ownerJwt, {
        action: "create", full_name: `QA Revoke ${stamp}`, role: "sales", location_id: locationId,
      });
      const cBody = await c.json().catch(() => ({}));
      const revokeId = cBody?.invite?.id;
      const revokeToken = cBody?.invite?.token;

      const r = await callInviteCreate(ownerJwt, {
        action: "revoke", invite_id: revokeId,
      });
      const rBody = await r.json().catch(() => ({}));

      // After revoke, the token must no longer resolve
      const after = await callInviteAccept("info", revokeToken);
      push({
        case: "I11. revoke deletes invite (post-revoke info → 404)",
        expected: "revoke 200 then info 404",
        actual: `revoke=${r.status}(${rBody?.success ? "ok" : "fail"}) info=${after.status}`,
        pass: r.status === 200 && rBody?.success === true && after.status === 404,
      });
    }

    // ── CASE I12: non-owner cannot create invites ───────────────
    // We sign in as the invitee we just created via PIN/email mapping.
    // The pos-login flow returns a session — non-owner role.
    if (inviteeUserId) {
      const normalizedUsername = inviteeName.trim().toLowerCase().replace(/\s+/g, " ");
      const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;
      const c2 = createClient(url, anonKey);
      const { data: empSess, error: empErr } = await c2.auth.signInWithPassword({
        email: mappedEmail, password: inviteePin,
      });
      if (!empErr && empSess.session) {
        const r = await callInviteCreate(empSess.session.access_token, {
          action: "create", full_name: "Hacker", role: "sales", location_id: locationId,
        });
        const body = await r.json().catch(() => ({}));
        push({
          case: "I12. non-owner blocked from creating invites",
          expected: "403",
          actual: `status ${r.status} — ${body?.error || ""}`,
          pass: r.status === 403,
        });
      } else {
        push({
          case: "I12. non-owner blocked from creating invites",
          expected: "403",
          actual: `could not sign in as employee: ${empErr?.message || "no session"}`,
          pass: false,
        });
      }
    }

    // ── CLEANUP ─────────────────────────────────────────────────
    try { await admin.from("employee_invites").delete().eq("location_id", locationId!); } catch (_) { /* */ }
    try { await admin.from("employees").delete().eq("location_id", locationId!); } catch (_) { /* */ }
    try { await admin.from("locations").delete().eq("tenant_id", tenantId!); } catch (_) { /* */ }
    try { await admin.from("tenants").delete().eq("id", tenantId!); } catch (_) { /* */ }
    if (inviteeUserId) {
      try { await admin.auth.admin.deleteUser(inviteeUserId); } catch (_) { /* */ }
    }
    if (ownerUserId) {
      try { await admin.auth.admin.deleteUser(ownerUserId); } catch (_) { /* */ }
    }

    const allPass = results.every((r) => r.pass);
    return new Response(JSON.stringify({
      allPass, count: results.length, results,
    }, null, 2), {
      status: allPass ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    const stack = (err as Error)?.stack || "";
    console.error("qa-invite-tests fatal:", msg, stack);
    // Best-effort cleanup
    try {
      if (locationId) {
        await admin.from("employee_invites").delete().eq("location_id", locationId);
        await admin.from("employees").delete().eq("location_id", locationId);
      }
      if (tenantId) {
        await admin.from("locations").delete().eq("tenant_id", tenantId);
        await admin.from("tenants").delete().eq("id", tenantId);
      }
      if (inviteeUserId) await admin.auth.admin.deleteUser(inviteeUserId);
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
    } catch (_) { /* */ }
    return new Response(JSON.stringify({
      error: msg, stack, results,
    }, null, 2), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
