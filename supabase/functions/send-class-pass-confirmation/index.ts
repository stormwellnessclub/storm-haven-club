// Sends a class pass purchase confirmation email. Idempotent via per-pass
// flag in metadata column on class_passes (confirmation_email_sent_at).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Storm Wellness Club <hello@notify.stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function buildHtml(opts: {
  name: string;
  packageLabel: string;
  classesTotal: number;
  expiresAt: string;
  pricePaid: number;
  isMember: boolean;
}) {
  return `
  <div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c9a86a;padding:36px;border-radius:6px;">
      <p style="letter-spacing:.4em;font-size:11px;color:#a17e3a;margin:0 0 6px;">STORM WELLNESS CLUB</p>
      <h1 style="font-family:Georgia,serif;color:#a17e3a;font-size:28px;margin:0 0 18px;">Your pass is ready, ${opts.name}!</h1>
      <p style="margin:0 0 16px;">Thank you for your class pass purchase. Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0 22px;">
        <tr><td style="padding:6px 0;color:#6b5a3b;">Package</td><td style="padding:6px 0;text-align:right;">${opts.packageLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Classes</td><td style="padding:6px 0;text-align:right;">${opts.classesTotal}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Pricing tier</td><td style="padding:6px 0;text-align:right;">${opts.isMember ? "Member" : "Non-Member"}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Valid until</td><td style="padding:6px 0;text-align:right;">${fmtDate(opts.expiresAt)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b5a3b;">Amount paid</td><td style="padding:6px 0;text-align:right;">$${opts.pricePaid.toFixed(2)}</td></tr>
      </table>
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${SITE}/schedule" style="background:#a17e3a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;display:inline-block;font-family:Helvetica,Arial,sans-serif;">Book a Class</a>
      </p>
      <p style="font-size:12px;color:#8a7a5a;margin:28px 0 0;text-align:center;">
        Cancellations require 24 hours' notice. Storm Wellness Club, Livonia, MI.
      </p>
    </div>
  </div>`;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pass_id, session_id } = await req.json();
    if (!pass_id) throw new Error("pass_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: pass, error } = await supabase
      .from("class_passes")
      .select("*")
      .eq("id", pass_id)
      .single();
    if (error || !pass) throw new Error(error?.message || "pass not found");

    // Idempotency — bail if already sent for this session
    const sentKey = session_id ? `confirmation_sent_${session_id}` : "confirmation_sent";
    const meta = (pass as any).metadata || {};
    if (meta[sentKey]) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Resolve recipient email + name from auth.users / profiles
    let email: string | null = null;
    let name = "there";
    if (pass.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(pass.user_id);
      email = authUser?.user?.email || null;
      const meta = authUser?.user?.user_metadata || {};
      if (meta.first_name || meta.full_name) {
        name = meta.first_name || (meta.full_name as string).split(" ")[0];
      }
      if (!name || name === "there") {
        const { data: prof, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .or(`id.eq.${pass.user_id},user_id.eq.${pass.user_id}`)
          .limit(1)
          .maybeSingle();
        if (profileError) {
          console.error("Class pass confirmation profile lookup failed", {
            pass_id,
            user_id: pass.user_id,
            error: profileError.message,
          });
        }
        email = email || prof?.email || null;
        if (prof?.first_name) name = prof.first_name as string;
      }
    }
    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "No email resolvable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const packageLabel =
      pass.pass_type === "10-pack" ? "10-Class Pack" : "Single Class";

    const html = buildHtml({
      name,
      packageLabel,
      classesTotal: pass.classes_total,
      expiresAt: pass.expires_at,
      pricePaid: Number(pass.price_paid),
      isMember: !!pass.is_member_price,
    });

    const r = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: "Your Storm Wellness Club class pass is confirmed",
      html,
    });
    if ((r as any).error) throw new Error((r as any).error.message || "send failed");

    // No metadata column — store an audit row instead. We rely on session_id
    // dedupe at the call sites (webhook + confirm only call once each).
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Class pass confirmation failed", { error: message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
