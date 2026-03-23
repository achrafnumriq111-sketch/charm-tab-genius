import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PASSKIT_BASE = "https://api.pub1.passkit.io";

async function getPassKitHeaders() {
  const apiKey = Deno.env.get("PASSKIT_API_KEY");
  const apiSecret = Deno.env.get("PASSKIT_API_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("PassKit credentials not configured");
  }
  // PassKit REST API uses the API key + secret as a Bearer JWT
  // The API_KEY is the long-lived JWT token generated from PassKit portal
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const headers = await getPassKitHeaders();

    let result: any;

    switch (action) {
      // ─── ENROL A NEW MEMBER ──────────────────────────────
      case "enrol": {
        const { programId, tierId, externalId, name, email, phone, points } = params;
        const [givenNames, ...surnameParts] = (name || "").split(" ");
        const res = await fetch(`${PASSKIT_BASE}/members/member`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            programId,
            tierId,
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

      // ─── GET MEMBER BY EXTERNAL ID, EMAIL, OR PHONE ──
      case "getMember": {
        const { programId, externalId } = params;
        // Try by externalId first
        let res = await fetch(
          `${PASSKIT_BASE}/members/member/externalId/${programId}/${encodeURIComponent(externalId)}`,
          { method: "GET", headers }
        );
        if (res.status === 404) {
          // Try listing members filtered by email or phone
          const searchRes = await fetch(`${PASSKIT_BASE}/members/member/list`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              programId,
              limit: 1,
              filters: [
                { fieldPath: "person.emailAddress", operator: "eq", value: externalId },
              ],
            }),
          });
          const searchData = await searchRes.json();
          if (searchData?.members?.length > 0) {
            result = { ...searchData.members[0], found: true };
            break;
          }
          // Try by phone
          const phoneRes = await fetch(`${PASSKIT_BASE}/members/member/list`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              programId,
              limit: 1,
              filters: [
                { fieldPath: "person.mobileNumber", operator: "eq", value: externalId },
              ],
            }),
          });
          const phoneData = await phoneRes.json();
          if (phoneData?.members?.length > 0) {
            result = { ...phoneData.members[0], found: true };
            break;
          }
          result = { found: false };
          break;
        }
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        result.found = true;
        break;
      }

      // ─── EARN POINTS ────────────────────────────────────
      case "earnPoints": {
        const { memberId, externalId, programId, points } = params;
        const body: any = { points: points || 0 };
        if (memberId) body.id = memberId;
        else if (externalId && programId) {
          body.externalId = externalId;
          body.programId = programId;
        }
        const res = await fetch(`${PASSKIT_BASE}/members/member/points/earn`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      // ─── BURN POINTS ────────────────────────────────────
      case "burnPoints": {
        const { memberId, externalId, programId, points } = params;
        const body: any = { points: points || 0 };
        if (memberId) body.id = memberId;
        else if (externalId && programId) {
          body.externalId = externalId;
          body.programId = programId;
        }
        const res = await fetch(`${PASSKIT_BASE}/members/member/points/burn`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      // ─── LIST MEMBERS ──────────────────────────────────
      case "listMembers": {
        const { programId, limit, skip } = params;
        const res = await fetch(`${PASSKIT_BASE}/members/member/list`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            programId,
            limit: limit || 50,
            skip: skip || 0,
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      // ─── CHECK IN (record visit event) ─────────────────
      case "checkIn": {
        const { memberId, externalId, programId, lat, lon } = params;
        const body: any = {};
        if (memberId) body.id = memberId;
        else if (externalId && programId) {
          body.externalId = externalId;
          body.programId = programId;
        }
        if (lat && lon) body.location = { lat, lon };
        const res = await fetch(`${PASSKIT_BASE}/members/member/checkIn`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        result = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(result));
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PassKit error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
