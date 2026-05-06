// Admin in-house sale of a Mother's Day Special voucher.
// Records the sale (cash / check / card processed externally) and triggers the
// branded voucher email to the recipient (and buyer).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENDERS = new Set(["female", "male", "prefer_not_to_say"]);
const PAYMENT_METHODS = new Set(["cash", "check", "card_in_person", "card_external", "comp"]);

interface Body {
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_gender: string;
  is_gift: boolean;
  recipient_first_name?: string | null;
  recipient_last_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  recipient_gender?: string | null;
  gift_message?: string | null;
  massage_choice: string;
  massage_duration: 60 | 90;
  amount_cents: number;
  payment_method: string;
  admin_notes?: string | null;
  send_email?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin / front desk / staff
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anon.auth.getUser(auth.slice(7));
    const adminUser = userData?.user;
    if (!adminUser) throw new Error("Not authenticated");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id);
    const allowed = new Set(["admin", "super_admin", "front_desk", "staff", "manager"]);
    const ok = (roles || []).some((r: any) => allowed.has(r.role));
    if (!ok) throw new Error("Not authorized");

    const body: Body = await req.json();

    const missing = (v?: string | null) => !v || !String(v).trim();
    if (missing(body.buyer_first_name) || missing(body.buyer_last_name))
      throw new Error("Buyer first and last name are required");
    if (missing(body.buyer_email)) throw new Error("Buyer email is required");
    if (missing(body.buyer_phone)) throw new Error("Buyer phone is required");
    if (!GENDERS.has(body.buyer_gender)) throw new Error("Please select buyer gender");
    if (![60, 90].includes(body.massage_duration)) throw new Error("Invalid massage duration");
    if (missing(body.massage_choice)) throw new Error("Please choose a massage");
    if (!body.amount_cents || body.amount_cents < 0) throw new Error("Invalid amount");
    if (!PAYMENT_METHODS.has(body.payment_method)) throw new Error("Invalid payment method");

    if (body.is_gift) {
      if (missing(body.recipient_first_name) || missing(body.recipient_last_name))
        throw new Error("Recipient first and last name are required");
      if (missing(body.recipient_email)) throw new Error("Recipient email is required");
      if (!GENDERS.has(body.recipient_gender || "")) throw new Error("Please select recipient gender");
    }

    const buyerFirst = body.buyer_first_name.trim();
    const buyerLast = body.buyer_last_name.trim();
    const buyerName = `${buyerFirst} ${buyerLast}`.trim();
    const recipFirst = body.recipient_first_name?.trim() || null;
    const recipLast = body.recipient_last_name?.trim() || null;
    const recipName = body.is_gift ? `${recipFirst ?? ""} ${recipLast ?? ""}`.trim() || null : null;

    // Try to link buyer to an existing auth account by email
    let buyerUserId: string | null = null;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", body.buyer_email.trim())
      .maybeSingle();
    if (existingProfile?.user_id) buyerUserId = existingProfile.user_id;

    const baseCents = body.amount_cents;

    const { data: voucher, error: insErr } = await supabase
      .from("mothers_day_vouchers")
      .insert({
        buyer_user_id: buyerUserId,
        buyer_name: buyerName,
        buyer_first_name: buyerFirst,
        buyer_last_name: buyerLast,
        buyer_email: body.buyer_email.trim().toLowerCase(),
        buyer_phone: body.buyer_phone.trim(),
        buyer_gender: body.buyer_gender,
        recipient_name: recipName,
        recipient_first_name: recipFirst,
        recipient_last_name: recipLast,
        recipient_email: body.is_gift ? body.recipient_email?.trim().toLowerCase() : null,
        recipient_phone: body.is_gift ? body.recipient_phone?.trim() || null : null,
        recipient_gender: body.is_gift ? body.recipient_gender : null,
        gift_message: body.is_gift ? body.gift_message?.trim() || null : null,
        massage_choice: body.massage_choice.trim(),
        massage_duration: body.massage_duration,
        amount_paid_cents: baseCents,
        base_amount_cents: baseCents,
        processing_fee_cents: 0,
        status: "active",
        sold_in_house: true,
        sold_by_admin_id: adminUser.id,
        payment_method: body.payment_method,
        admin_notes: body.admin_notes?.trim() || null,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    if (body.send_email !== false) {
      try {
        await supabase.functions.invoke("send-mothers-day-voucher", {
          body: { voucher_id: voucher.id },
        });
      } catch (_e) {
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({ success: true, voucher }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
