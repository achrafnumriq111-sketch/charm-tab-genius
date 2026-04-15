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
    const { full_name, pin, setup_secret } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check if any owner exists — if not, allow first-time setup without secret
    const { data: existingOwners } = await admin
      .from("employees")
      .select("id")
      .eq("role", "owner")
      .limit(1);

    const isFirstSetup = !existingOwners || existingOwners.length === 0;

    if (!isFirstSetup) {
      // After first owner exists, require setup secret
      const expectedSecret = Deno.env.get("POS_SETUP_SECRET");
      if (!expectedSecret || setup_secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate inputs
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Ongeldige naam" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pin || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN moet exact 6 cijfers zijn" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (!isFirstSetup) {
      return new Response(JSON.stringify({ error: "Er bestaat al een owner account" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedUsername = full_name.trim().toLowerCase().replace(/\s+/g, " ");
    const mappedEmail = `${normalizedUsername.replace(/\s+/g, ".")}@pos.saakouk.internal`;

    // Check duplicate username
    const { data: existing } = await admin
      .from("employees")
      .select("id")
      .eq("username_normalized", normalizedUsername)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Gebruikersnaam bestaat al" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user (Supabase handles bcrypt hashing of the PIN)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: mappedEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role: "owner" },
    });

    if (authError || !authUser.user) {
      console.error("Auth user creation failed:", authError);
      return new Response(JSON.stringify({ error: "Kon account niet aanmaken" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create employee record
    const { error: empError } = await admin.from("employees").insert({
      user_id: authUser.user.id,
      full_name: full_name.trim(),
      username_normalized: normalizedUsername,
      role: "owner",
      is_active: true,
    });

    if (empError) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(authUser.user.id);
      console.error("Employee creation failed:", empError);
      return new Response(JSON.stringify({ error: "Kon medewerker niet aanmaken" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Owner account aangemaakt" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Setup error:", err);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
