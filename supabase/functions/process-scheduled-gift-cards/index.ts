// Cron-invoked worker that sends scheduled gift cards when their time arrives.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { data: due, error } = await supabase
      .from("gift_cards")
      .select("id, code, amount_cents, recipient_name, recipient_email, custom_message, purchaser_name, expires_at, service_label, hide_amount")
      .eq("status", "scheduled")
      .lte("scheduled_send_at", new Date().toISOString())
      .limit(100);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const card of due ?? []) {
      try {
        const { error: emailErr } = await supabase.functions.invoke("send-email", {
          body: {
            type: "gift_card_delivery",
            to: card.recipient_email,
            data: {
              name: card.recipient_name,
              recipientName: card.recipient_name,
              senderName: card.purchaser_name || "A Storm Wellness Club member",
              customMessage: card.custom_message || "",
              code: card.code,
              amount: (Number(card.amount_cents) / 100).toFixed(2),
              serviceLabel: (card as any).service_label || "",
              hideAmount: (card as any).hide_amount === true,
              expiresAt: card.expires_at,
            },
          },
        });
        if (emailErr) throw emailErr;

        await supabase
          .from("gift_cards")
          .update({
            status: "active",
            email_sent_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
          })
          .eq("id", card.id);
        sent++;
      } catch (e) {
        console.error("[PROCESS-SCHEDULED-GIFT-CARDS] send failed", card.id, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: due?.length ?? 0, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PROCESS-SCHEDULED-GIFT-CARDS] ERROR", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
