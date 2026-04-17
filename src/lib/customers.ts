import { supabase } from "@/integrations/supabase/client";

export interface CustomerInput {
  locationId: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: "gift_card" | "qr_order" | "pos" | "manual" | "passkit";
  passkitMemberId?: string | null;
  spentDelta?: number; // amount to add to total_spent
  incrementVisit?: boolean;
}

/**
 * Upserts a customer record per location. Matches on (location_id, lower(email))
 * when email present, otherwise on (location_id, phone). Increments spent + visits.
 * Safe to call from any capture point (gift card issued, POS sale, QR order).
 */
export async function upsertCustomer(input: CustomerInput): Promise<{ error?: string; id?: string }> {
  const {
    locationId,
    fullName,
    email,
    phone,
    source = "pos",
    passkitMemberId = null,
    spentDelta = 0,
    incrementVisit = true,
  } = input;

  if (!locationId) return { error: "missing_location" };
  if (!fullName?.trim()) return { error: "missing_name" };
  const cleanEmail = email?.trim().toLowerCase() || null;
  const cleanPhone = phone?.trim() || null;
  if (!cleanEmail && !cleanPhone) return { error: "missing_contact" };

  // Lookup existing by email first, then phone
  let existing: { id: string; total_spent: number; visit_count: number } | null = null;
  if (cleanEmail) {
    const { data } = await supabase
      .from("customers")
      .select("id,total_spent,visit_count")
      .eq("location_id", locationId)
      .ilike("email", cleanEmail)
      .maybeSingle();
    existing = data as any;
  }
  if (!existing && cleanPhone) {
    const { data } = await supabase
      .from("customers")
      .select("id,total_spent,visit_count")
      .eq("location_id", locationId)
      .eq("phone", cleanPhone)
      .maybeSingle();
    existing = data as any;
  }

  if (existing) {
    const { error } = await supabase
      .from("customers")
      .update({
        full_name: fullName,
        email: cleanEmail,
        phone: cleanPhone,
        passkit_member_id: passkitMemberId ?? undefined,
        total_spent: Number(existing.total_spent || 0) + Number(spentDelta || 0),
        visit_count: Number(existing.visit_count || 0) + (incrementVisit ? 1 : 0),
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { id: existing.id };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      location_id: locationId,
      full_name: fullName,
      email: cleanEmail,
      phone: cleanPhone,
      source,
      passkit_member_id: passkitMemberId,
      total_spent: spentDelta,
      visit_count: incrementVisit ? 1 : 0,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data?.id };
}
