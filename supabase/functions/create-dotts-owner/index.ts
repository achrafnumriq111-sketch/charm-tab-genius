// One-shot bootstrap: creates the DOTTS platform owner account (owner@dotts.app)
// and registers it as a platform_admin. Idempotent — re-running rotates the
// password but never creates a duplicate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOTTS_OWNER_EMAIL = "owner@dotts.app";
const DOTTS_OWNER_NAME = "DOTTS Owner";

function strongPassword(len = 22) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find or create the auth user
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (listErr) throw listErr;
    let user = (list.users ?? []).find((u) => (u.email ?? "").toLowerCase() === DOTTS_OWNER_EMAIL);

    const password = strongPassword();
    let created = false;

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: DOTTS_OWNER_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: DOTTS_OWNER_NAME, role: "platform_owner" },
      });
      if (error) throw error;
      user = data.user!;
      created = true;
    } else {
      // Rotate password on re-run
      const { error } = await admin.auth.admin.updateUserById(user.id, { password });
      if (error) throw error;
    }

    // 2. Ensure platform_admins row
    const { data: existingAdmin } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingAdmin) {
      const { error: insErr } = await admin
        .from("platform_admins")
        .insert({ user_id: user.id });
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify(
        {
          ok: true,
          created,
          email: DOTTS_OWNER_EMAIL,
          password,
          user_id: user.id,
          note: "Platform owner. Has cross-tenant access via platform_admins (incl. Jarvis).",
        },
        null,
        2,
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
