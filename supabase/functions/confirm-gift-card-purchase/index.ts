// Confirms an online gift card purchase: verifies the PaymentIntent succeeded,
// activates the pending gift card, and sends the recipient gift email
// (or leaves it queued for the scheduled send job) plus a purchaser receipt.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_intent_id } = await req.json().catch(() => ({}));
    if (!payment_intent_id) return json({ success: false, error: "payment_intent_id is required" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const pi = await stripe.paymentIntents.retrieve(String(payment_intent_id));
    if (pi.status !== "succeeded") {
      return json({ success: false, error: "Payment has not completed", status: pi.status });
    }

    const { data: card } = await supabase
      .from("gift_cards")
      .select("*")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (!card) return json({ success: false, error: "Gift card not found for this payment" });

    const scheduled = card.scheduled_send_at && new Date(card.scheduled_send_at).getTime() > Date.now() + 60_000;

    // Already processed → return the card as-is (idempotent).
    if (card.status !== "pending") {
      return json({ success: true, alreadyProcessed: true, card: publicCard(card) });
    }

    const { data: updated, error: upErr } = await supabase
      .from("gift_cards")
      .update({ status: scheduled ? "scheduled" : "active" })
      .eq("id", card.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (upErr) throw upErr;
    const finalCard = updated ?? card;

    let emailSent = false;
    if (!scheduled) {
      try {
        const { error: emailErr } = await supabase.functions.invoke("send-email", {
          body: {
            type: "gift_card_delivery",
            to: finalCard.recipient_email,
            data: {
              name: finalCard.recipient_name,
              recipientName: finalCard.recipient_name,
              senderName: finalCard.purchaser_name || "A Storm Wellness Club member",
              customMessage: finalCard.custom_message || "",
              serviceLabel: finalCard.service_label || "",
              code: finalCard.code,
              amount: (Number(finalCard.amount_cents) / 100).toFixed(2),
              expiresAt: finalCard.expires_at,
            },
          },
        });
        if (!emailErr) {
          emailSent = true;
          await supabase
            .from("gift_cards")
            .update({ email_sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() })
            .eq("id", finalCard.id);
        } else {
          console.error("[CONFIRM-GIFT-CARD] recipient email failed", emailErr);
        }
      } catch (e) {
        console.error("[CONFIRM-GIFT-CARD] recipient email threw", String(e));
      }
    }

    // Purchaser receipt (non-fatal)
    if (finalCard.purchaser_email) {
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "gift_card_purchase_receipt",
            to: finalCard.purchaser_email,
            data: {
              purchaserName: finalCard.purchaser_name || "there",
              amount: (Number(finalCard.amount_cents) / 100).toFixed(2),
              serviceLabel: finalCard.service_label || "",
              recipientName: finalCard.recipient_name,
              recipientEmail: finalCard.recipient_email,
              code: finalCard.code,
              scheduledSendAt: scheduled ? finalCard.scheduled_send_at : null,
            },
          },
        });
      } catch (e) {
        console.error("[CONFIRM-GIFT-CARD] receipt email threw", String(e));
      }
    }

    return json({ success: true, emailSent, scheduled: !!scheduled, card: publicCard(finalCard) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CONFIRM-GIFT-CARD] ERROR", msg);
    return json({ success: false, error: msg });
  }
});

function publicCard(c: Record<string, unknown>) {
  return {
    id: c.id,
    code: c.code,
    amount_cents: c.amount_cents,
    service_label: c.service_label,
    recipient_name: c.recipient_name,
    recipient_email: c.recipient_email,
    custom_message: c.custom_message,
    scheduled_send_at: c.scheduled_send_at,
    expires_at: c.expires_at,
  };
}
