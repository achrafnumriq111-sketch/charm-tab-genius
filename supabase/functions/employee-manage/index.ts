import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated owner
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is owner
    const { data: callerEmp } = await admin
      .from("employees")
      .select("role, location_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerEmp || callerEmp.role !== "owner") {
      return new Response(JSON.stringify({ error: "Alleen owners kunnen medewerkers beheren" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ─── CREATE ──────────────────────────────────────────────────────
    if (action === "create") {
      const { full_name, pin, role, location_id } = body;

      if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
        return new Response(JSON.stringify({ error: "Ongeldige naam" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!pin || !/^\d{6}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN moet exact 6 cijfers zijn" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const validRoles = ["owner", "manager", "sales"];
      const empRole = validRoles.includes(role) ? role : "sales";
      const locId = location_id || callerEmp.location_id;

      const normalizedUsername = full_name.trim().toLowerCase().replace(/\s+/g, " ");
      const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;

      // Check duplicate
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

      // Create auth user
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: mappedEmail,
        password: pin,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim(), role: empRole },
      });

      if (authError || !authUser.user) {
        console.error("Auth creation failed:", authError);
        return new Response(JSON.stringify({ error: "Kon account niet aanmaken" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create employee record
      const { data: newEmp, error: empError } = await admin.from("employees").insert({
        user_id: authUser.user.id,
        full_name: full_name.trim(),
        username_normalized: normalizedUsername,
        role: empRole,
        location_id: locId,
        is_active: true,
      }).select().single();

      if (empError) {
        await admin.auth.admin.deleteUser(authUser.user.id);
        console.error("Employee creation failed:", empError);
        return new Response(JSON.stringify({ error: "Kon medewerker niet aanmaken" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, employee: newEmp }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── UPDATE PIN ──────────────────────────────────────────────────
    if (action === "update_pin") {
      const { employee_id, new_pin } = body;
      if (!new_pin || !/^\d{6}$/.test(new_pin)) {
        return new Response(JSON.stringify({ error: "PIN moet exact 6 cijfers zijn" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: emp } = await admin.from("employees").select("user_id").eq("id", employee_id).single();
      if (!emp?.user_id) {
        return new Response(JSON.stringify({ error: "Medewerker niet gevonden" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password: new_pin });
      if (error) {
        return new Response(JSON.stringify({ error: "Kon PIN niet wijzigen" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DELETE ──────────────────────────────────────────────────────
    if (action === "delete") {
      const { employee_id } = body;
      const { data: emp } = await admin.from("employees").select("user_id").eq("id", employee_id).single();

      if (emp?.user_id) {
        await admin.auth.admin.deleteUser(emp.user_id);
      }
      await admin.from("employees").delete().eq("id", employee_id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Employee manage error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
