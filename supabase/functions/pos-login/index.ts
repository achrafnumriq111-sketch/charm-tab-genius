import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, pin, tenant_slug } = await req.json();

    // Input validation
    if (!username || typeof username !== "string" || !pin || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "Ongeldige inloggegevens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PIN format validation (exactly 6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "Ongeldige inloggegevens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, " ");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    // Build employee query - optionally scoped to tenant
    let empQuery = admin
      .from("employees")
      .select("*, locations!inner(tenant_id, tenants!inner(slug))")
      .eq("username_normalized", normalizedUsername);

    // If tenant_slug provided, scope to that tenant
    if (tenant_slug && typeof tenant_slug === "string") {
      empQuery = empQuery.eq("locations.tenants.slug", tenant_slug);
    }

    const { data: employee, error: lookupError } = await empQuery.single();

    if (!employee || lookupError) {
      // Log failed attempt - unknown user
      await admin.from("login_audit_logs").insert({
        event_type: "login_failed",
        username_attempted: normalizedUsername,
        ip_address: ip,
        user_agent: ua,
        details: { reason: "user_not_found" },
      });
      // Constant-time delay to prevent timing attacks
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
      return new Response(JSON.stringify({ error: "Ongeldige inloggegevens" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if active
    if (!employee.is_active) {
      await admin.from("login_audit_logs").insert({
        employee_id: employee.id,
        event_type: "login_failed",
        username_attempted: normalizedUsername,
        ip_address: ip,
        user_agent: ua,
        details: { reason: "account_inactive" },
      });
      return new Response(JSON.stringify({ error: "Ongeldige inloggegevens" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check lockout
    if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
      const remainingMs = new Date(employee.locked_until).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      await admin.from("login_audit_logs").insert({
        employee_id: employee.id,
        event_type: "login_failed",
        username_attempted: normalizedUsername,
        ip_address: ip,
        user_agent: ua,
        details: { reason: "account_locked" },
      });
      return new Response(
        JSON.stringify({
          error: `Account tijdelijk vergrendeld. Probeer het over ${remainingMin} minuten opnieuw.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt authentication via Supabase Auth
    const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;

    const { data: authData, error: authError } = await admin.auth.signInWithPassword({
      email: mappedEmail,
      password: pin,
    });

    if (authError || !authData.session) {
      // Increment failed attempts
      const newAttempts = (employee.failed_login_attempts || 0) + 1;
      const updates: Record<string, unknown> = { failed_login_attempts: newAttempts };

      if (newAttempts >= MAX_ATTEMPTS) {
        updates.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        await admin.from("login_audit_logs").insert({
          employee_id: employee.id,
          event_type: "lockout",
          username_attempted: normalizedUsername,
          ip_address: ip,
          user_agent: ua,
          details: { attempts: newAttempts, lockout_minutes: LOCKOUT_MINUTES },
        });
      }

      await admin.from("employees").update(updates).eq("id", employee.id);

      await admin.from("login_audit_logs").insert({
        employee_id: employee.id,
        event_type: "login_failed",
        username_attempted: normalizedUsername,
        ip_address: ip,
        user_agent: ua,
        details: { attempts: newAttempts },
      });

      return new Response(JSON.stringify({ error: "Ongeldige inloggegevens" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success - reset failed attempts, update last login
    await admin.from("employees").update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    }).eq("id", employee.id);

    // Log successful login
    await admin.from("login_audit_logs").insert({
      employee_id: employee.id,
      event_type: "login_success",
      username_attempted: normalizedUsername,
      ip_address: ip,
      user_agent: ua,
    });

    // Resolve tenant info for response
    const tenantInfo = employee.locations?.tenants;

    return new Response(
      JSON.stringify({
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
        employee: {
          id: employee.id,
          full_name: employee.full_name,
          role: employee.role,
          location_id: employee.location_id,
        },
        tenant: tenantInfo ? {
          slug: tenantInfo.slug,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Login error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis. Probeer het opnieuw." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
