import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, token } = body;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Ongeldige uitnodiging" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite } = await admin
      .from("employee_invites")
      .select("*, locations:location_id(name, tenant_id, tenants:tenant_id(name, slug))")
      .eq("token", token)
      .maybeSingle();

    if (!invite) {
      return new Response(JSON.stringify({ error: "Uitnodiging niet gevonden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.accepted_at) {
      await admin.from("security_events").insert({
        event_type: "invite_token_reuse",
        severity: "warning",
        source: "edge:invite-accept",
        target_resource: invite.id,
        metadata: { token_prefix: token.slice(0, 8), accepted_at: invite.accepted_at },
      });
      return new Response(JSON.stringify({ error: "Uitnodiging al gebruikt" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from("security_events").insert({
        event_type: "invite_token_expired",
        severity: "info",
        source: "edge:invite-accept",
        target_resource: invite.id,
        metadata: { token_prefix: token.slice(0, 8), expires_at: invite.expires_at },
      });
      return new Response(JSON.stringify({ error: "Uitnodiging is verlopen" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── INFO ─────────────────────────────────────────────────────
    if (action === "info") {
      return new Response(JSON.stringify({
        full_name: invite.full_name,
        role: invite.role,
        location_name: (invite as any).locations?.name,
        tenant_name: (invite as any).locations?.tenants?.name,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACCEPT ───────────────────────────────────────────────────
    if (action === "accept") {
      const { pin } = body;
      if (!pin || !/^\d{6}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN moet exact 6 cijfers zijn" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedUsername = invite.full_name.trim().toLowerCase().replace(/\s+/g, " ");
      const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;

      const { data: existing } = await admin
        .from("employees")
        .select("id")
        .eq("username_normalized", normalizedUsername)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: "Gebruikersnaam bestaat al" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: mappedEmail,
        password: pin,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name, role: invite.role },
      });

      if (authError || !authUser.user) {
        console.error("Auth create failed:", authError);
        return new Response(JSON.stringify({ error: "Kon account niet aanmaken" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newEmp, error: empError } = await admin.from("employees").insert({
        user_id: authUser.user.id,
        full_name: invite.full_name,
        username_normalized: normalizedUsername,
        role: invite.role,
        location_id: invite.location_id,
        is_active: true,
      }).select().single();

      if (empError) {
        await admin.auth.admin.deleteUser(authUser.user.id);
        console.error("Employee create failed:", empError);
        return new Response(JSON.stringify({ error: "Kon medewerker niet aanmaken" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("employee_invites").update({
        accepted_at: new Date().toISOString(),
        accepted_employee_id: newEmp.id,
      }).eq("id", invite.id);

      return new Response(JSON.stringify({
        success: true,
        full_name: invite.full_name,
        tenant_slug: (invite as any).locations?.tenants?.slug,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-accept error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
