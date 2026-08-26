// Sends an abandoned class pass checkout reminder email.
// Triggered by process-abandoned-class-pass-checkouts cron.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";

interface Body {
  to: string;
  name?: string;
  product_kind: "class_pass" | "mothers_day_pack";
  reminder_step: 1 | 2 | 3;
}

const subjects = {
  class_pass: [
    "Finish your class pass purchase",
    "Your class pass is waiting",
    "Last chance — your class pass is still in your cart",
  ],
  mothers_day_pack: [
    "Finish your Mother's Day Class Pack",
    "Your Mother's Day gift is waiting",
    "Last chance — Mother's Day Class Pack",
  ],
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { to, name, product_kind, reminder_step }: Body = await req.json();
    if (!to || !product_kind || !reminder_step) throw new Error("missing fields");

    const link =
      product_kind === "mothers_day_pack"
        ? `${SITE}/class-passes#mothers-day`
        : `${SITE}/class-passes`;

    const productLabel =
      product_kind === "mothers_day_pack"
        ? "Mother's Day Class Pack (10 classes)"
        : "class pass";

    const greeting = name ? `Hi ${name},` : "Hi there,";
    const urgency =
      reminder_step === 1
        ? "We saved your spot — finish checkout when you're ready."
        : reminder_step === 2
        ? "Just a reminder — your purchase is still waiting."
        : "Last chance — your selection will be cleared soon.";

    const html = `
    <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
        <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
        <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:26px;margin:0 0 16px;">Finish your ${productLabel}</h1>
        <p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 18px;">You started a ${productLabel} purchase but didn't complete checkout. ${urgency}</p>
        <p style="text-align:center;margin:28px 0 0;">
          <a href="${link}" style="background:#a17e3a;color:#fff;padding:14px 30px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">Complete My Purchase</a>
        </p>
        <p style="font-size:12px;color:#8a7a5a;margin:32px 0 0;text-align:center;">
          You only receive this message because you started a checkout on stormwellnessclub.com.
          You will not be charged unless checkout completes.
        </p>
      </div>
    </div>`;

    const r = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: subjects[product_kind][reminder_step - 1],
      html,
    });
    if ((r as any).error) throw new Error((r as any).error.message || "send failed");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
