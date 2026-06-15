import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin Impersonate Edge Function
 * 
 * Allows platform admins to get a scoped session for a tenant's owner account.
 * This creates a temporary auth session as the tenant owner — used for support/debugging.
 * 
 * Actions:
 *   start — begin impersonation, returns session tokens
 *   stop  — log end of impersonation session
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is platform admin via their JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ongeldige sessie" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check platform admin
    const { data: adminCheck } = await admin
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Geen platform admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, tenant_id, log_id } = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    if (action === "start") {
      if (!tenant_id || typeof tenant_id !== "string") {
        return new Response(JSON.stringify({ error: "tenant_id verplicht" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get tenant info
      const { data: tenant, error: tenantErr } = await admin
        .from("tenants")
        .select("id, name, slug, owner_user_id")
        .eq("id", tenant_id)
        .single();

      if (tenantErr || !tenant) {
        return new Response(JSON.stringify({ error: "Tenant niet gevonden" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the tenant owner's employee record to find their location.
      // Fallback: any active owner-role employee within the tenant, then any active employee,
      // then synthesize a virtual record from the first location (QA/empty tenants).
      let ownerEmployee:
        | { id: string | null; full_name: string; role: string; location_id: string | null }
        | null = null;

      const { data: byOwnerUser } = await admin
        .from("employees")
        .select("id, full_name, role, location_id, locations!inner(tenant_id)")
        .eq("user_id", tenant.owner_user_id)
        .eq("is_active", true)
        .eq("locations.tenant_id", tenant.id)
        .maybeSingle();
      if (byOwnerUser) ownerEmployee = byOwnerUser as any;

      if (!ownerEmployee) {
        const { data: anyEmp } = await admin
          .from("employees")
          .select("id, full_name, role, location_id, locations!inner(tenant_id)")
          .eq("locations.tenant_id", tenant.id)
          .eq("is_active", true)
          .order("role", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (anyEmp) ownerEmployee = anyEmp as any;
      }

      if (!ownerEmployee) {
        const { data: firstLoc } = await admin
          .from("locations")
          .select("id")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!firstLoc) {
          return new Response(JSON.stringify({ error: "Tenant heeft geen locaties" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        ownerEmployee = {
          id: null,
          full_name: `${tenant.name} (admin)`,
          role: "owner",
          location_id: firstLoc.id,
        };
      }


      // Log the impersonation (platform-only log, not in tenant audit)
      const { data: logEntry } = await admin
        .from("admin_impersonation_log")
        .insert({
          admin_user_id: user.id,
          target_tenant_id: tenant.id,
          target_tenant_name: tenant.name,
          ip_address: ip,
          user_agent: ua,
        })
        .select("id")
        .single();

      // Return tenant info + owner employee info for client-side impersonation
      // The admin keeps their own auth session but the client switches context
      return new Response(JSON.stringify({
        impersonation: {
          log_id: logEntry?.id,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          },
          employee: {
            id: ownerEmployee.id,
            full_name: ownerEmployee.full_name,
            role: ownerEmployee.role,
            location_id: ownerEmployee.location_id,
          },
        },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "stop") {
      // Mark impersonation as ended
      if (log_id && typeof log_id === "string") {
        await admin
          .from("admin_impersonation_log")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", log_id)
          .eq("admin_user_id", user.id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Onbekende actie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error("Impersonation error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
