// Sell a gift card from a member's account (or accept cash/clover/external).
// Records the gift_cards row and triggers the delivery email to the recipient.
// Card charging is done by the caller via the existing stripe-payment function
// so 3DS flows behave identically to the rest of the POS.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) =>
  console.log(`[CREATE-GIFT-CARD] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Authentication failed");
    const user = userData.user;

    // Staff-only
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "admin", "manager", "front_desk"]);
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      purchaserMemberId,
      purchaserUserId,
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      customMessage,
      amountCents,
      paymentMethod,
      paymentReference,
      expiresAt,
      notes,
    } = body as {
      purchaserMemberId?: string;
      purchaserUserId?: string;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName: string;
      recipientEmail: string;
      customMessage?: string;
      amountCents: number;
      paymentMethod: "card_on_file" | "cash" | "clover" | "external";
      paymentReference?: string;
      expiresAt?: string;
      notes?: string;
    };

    if (!recipientName?.trim()) throw new Error("Recipient name is required");
    if (!recipientEmail?.trim()) throw new Error("Recipient email is required");
    if (!Number.isFinite(amountCents) || amountCents < 500) throw new Error("Amount must be at least $5.00");
    if (!["card_on_file", "cash", "clover", "external"].includes(paymentMethod)) {
      throw new Error("Invalid payment method");
    }

    // Generate a unique code via SECURITY DEFINER RPC.
    const { data: codeData, error: codeErr } = await supabase.rpc("generate_gift_card_code");
    if (codeErr) throw codeErr;
    const code: string = codeData as any;
    if (!code) throw new Error("Failed to generate gift card code");

    const insertPayload: Record<string, unknown> = {
      code,
      amount_cents: Math.round(amountCents),
      balance_cents: Math.round(amountCents),
      purchaser_member_id: purchaserMemberId || null,
      purchaser_user_id: purchaserUserId || null,
      purchaser_name: purchaserName || null,
      purchaser_email: purchaserEmail || null,
      recipient_name: recipientName.trim(),
      recipient_email: recipientEmail.trim().toLowerCase(),
      custom_message: customMessage?.trim() || null,
      payment_method: paymentMethod,
      payment_reference: paymentReference || null,
      status: "active",
      issued_by: user.id,
      notes: notes?.trim() || null,
      expires_at: expiresAt || null,
    };

    const { data: card, error: insertErr } = await supabase
      .from("gift_cards")
      .insert(insertPayload)
      .select("id, code, amount_cents, expires_at, recipient_name, recipient_email, custom_message, purchaser_name")
      .single();
    if (insertErr) throw insertErr;

    log("Card created", { id: card.id, code: card.code });

    // Send delivery email.
    let emailSent = false;
    try {
      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        body: {
          type: "gift_card_delivery",
          to: card.recipient_email,
          data: {
            name: card.recipient_name,
            recipientName: card.recipient_name,
            senderName: card.purchaser_name || purchaserName || "A Storm Wellness Club member",
            customMessage: card.custom_message || "",
            code: card.code,
            amount: (Number(card.amount_cents) / 100).toFixed(2),
            expiresAt: card.expires_at,
          },
        },
      });
      if (emailErr) {
        log("Email send failed", { err: String(emailErr) });
      } else {
        emailSent = true;
        await supabase
          .from("gift_cards")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", card.id);
      }
    } catch (e) {
      log("Email send threw", { err: String(e) });
    }

    return new Response(
      JSON.stringify({ success: true, id: card.id, code: card.code, emailSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CREATE-GIFT-CARD] ERROR", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
