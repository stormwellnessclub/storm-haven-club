// Verifies a Stripe Checkout Session for a class pass purchase, marks the
// pending checkout as completed, and triggers a confirmation email (idempotent).
// Credit/pass creation itself happens in stripe-webhook — this function only
// reads the pass row and emails the buyer.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string") {
      throw new Error("session_id required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify with Stripe — never trust client.
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, paid: false, error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    const md = session.metadata || {};
    if (md.type !== "class_pass") {
      return new Response(
        JSON.stringify({ success: false, error: "Not a class pass session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Mark pending checkout completed (idempotent)
    await supabase
      .from("pending_class_pass_checkouts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("stripe_session_id", session_id)
      .eq("status", "pending");

    // Look up the class pass row for this user/session — wait briefly for webhook
    const userId = md.user_id;
    let pass: any = null;
    for (let i = 0; i < 5 && !pass; i++) {
      const { data } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && new Date(data.created_at).getTime() > Date.now() - 30 * 60 * 1000) {
        pass = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    // Send confirmation email (idempotent via send-class-pass-confirmation)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (pass) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-class-pass-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            session_id,
            pass_id: pass.id,
          }),
        });
      } catch (_) {
        // best-effort
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paid: true,
        pass: pass
          ? {
              id: pass.id,
              category: pass.category,
              pass_type: pass.pass_type,
              classes_total: pass.classes_total,
              classes_remaining: pass.classes_remaining,
              expires_at: pass.expires_at,
              price_paid: Number(pass.price_paid),
            }
          : null,
        amount_total: session.amount_total,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
