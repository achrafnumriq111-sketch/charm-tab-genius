import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PASSKIT_BASE = "https://api.pub1.passkit.io";

async function getPassKitHeaders() {
  const apiKey = Deno.env.get("PASSKIT_API_KEY");
  if (!apiKey) throw new Error("PassKit credentials not configured");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function authenticateRequest(req: Request): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  // Fetch employee role
  const { data: emp } = await admin.from("employees")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!emp) throw new Error("No active employee found");

  return { userId: user.id, role: emp.role };
}

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate all requests
    const { role } = await authenticateRequest(req);

    const { action, ...params } = await req.json();
    const headers = await getPassKitHeaders();

    let result: any;

    switch (action) {
      case "enrol": {
        requireRole(role, ["owner", "manager", "cashier"]);
        const { programId, tierId, externalId, name, email, phone, points } = params;
        const [givenNames, ...surnameParts] = (name || "").split(" ");
        const res = await fetch(`${PASSKIT_BASE}/members/member`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            programId, tierId,
            externalId: externalId || undefined,
            person: {
              forename: givenNames || "",
              surname: surnameParts.join(" ") || "",
              emailAddress: email || "",
              mobileNumber: phone || "",
            },
            points: points ? { currentPoints: points } : undefined,
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      case "getMember": {
        // All authenticated staff can look up members
        const { programId, externalId } = params;
        let res = await fetch(
          `${PASSKIT_BASE}/members/member/externalId/${programId}/${encodeURIComponent(externalId)}`,
          { method: "GET", headers }
        );
        if (res.status === 404) {
          const searchRes = await fetch(`${PASSKIT_BASE}/members/member/list`, {
            method: "POST", headers,
            body: JSON.stringify({ programId, limit: 1, filters: [{ fieldPath: "person.emailAddress", operator: "eq", value: externalId }] }),
          });
          const searchData = await searchRes.json();
          if (searchData?.members?.length > 0) { result = { ...searchData.members[0], found: true }; break; }
          const phoneRes = await fetch(`${PASSKIT_BASE}/members/member/list`, {
            method: "POST", headers,
            body: JSON.stringify({ programId, limit: 1, filters: [{ fieldPath: "person.mobileNumber", operator: "eq", value: externalId }] }),
          });
          const phoneData = await phoneRes.json();
          if (phoneData?.members?.length > 0) { result = { ...phoneData.members[0], found: true }; break; }
          result = { found: false }; break;
        }
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        result.found = true;
        break;
      }

      case "earnPoints": {
        requireRole(role, ["owner", "manager", "cashier"]);
        const { memberId, externalId, programId, points } = params;
        const body: any = { points: points || 0 };
        if (memberId) body.id = memberId;
        else if (externalId && programId) { body.externalId = externalId; body.programId = programId; }
        const res = await fetch(`${PASSKIT_BASE}/members/member/points/earn`, { method: "PUT", headers, body: JSON.stringify(body) });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      case "burnPoints": {
        requireRole(role, ["owner", "manager", "cashier"]);
        const { memberId, externalId, programId, points } = params;
        const body: any = { points: points || 0 };
        if (memberId) body.id = memberId;
        else if (externalId && programId) { body.externalId = externalId; body.programId = programId; }
        const res = await fetch(`${PASSKIT_BASE}/members/member/points/burn`, { method: "PUT", headers, body: JSON.stringify(body) });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      case "listMembers": {
        requireRole(role, ["owner", "manager"]);
        const { programId, limit, skip } = params;
        const res = await fetch(`${PASSKIT_BASE}/members/member/list`, {
          method: "POST", headers,
          body: JSON.stringify({ programId, limit: limit || 50, skip: skip || 0 }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      case "checkIn": {
        requireRole(role, ["owner", "manager", "cashier"]);
        const { memberId, externalId, programId, lat, lon } = params;
        const body: any = {};
        if (memberId) body.id = memberId;
        else if (externalId && programId) { body.externalId = externalId; body.programId = programId; }
        if (lat && lon) body.location = { lat, lon };
        const res = await fetch(`${PASSKIT_BASE}/members/member/checkIn`, { method: "PUT", headers, body: JSON.stringify(body) });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error.message || "Internal error";
    const status = msg === "Unauthorized" ? 401 : msg.startsWith("Forbidden") ? 403 : 500;
    console.error("PassKit error:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
