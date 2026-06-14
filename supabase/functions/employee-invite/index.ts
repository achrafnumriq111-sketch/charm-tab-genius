import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerEmp } = await admin
      .from("employees")
      .select("role, location_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerEmp || callerEmp.role !== "owner") {
      return new Response(JSON.stringify({ error: "Alleen owners kunnen uitnodigen" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json().then((b) => ({ action: b.action, ...b })).catch(() => ({ action: null }));
    const body = await req.clone().json().catch(() => ({}));

    if (body.action === "create") {
      const { full_name, role, location_id } = body;
      if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
        return new Response(JSON.stringify({ error: "Ongeldige naam" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const validRoles = ["owner", "manager", "sales"];
      const empRole = validRoles.includes(role) ? role : "sales";
      const locId = location_id || callerEmp.location_id;

      const newToken = randomToken();
      const { data: invite, error } = await admin.from("employee_invites").insert({
        token: newToken,
        full_name: full_name.trim(),
        role: empRole,
        location_id: locId,
        invited_by: caller.id,
      }).select().single();

      if (error) {
        console.error("Invite create failed:", error);
        return new Response(JSON.stringify({ error: "Kon uitnodiging niet aanmaken" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, invite }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "revoke") {
      const { invite_id } = body;
      await admin.from("employee_invites").delete().eq("id", invite_id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("employee-invite error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
