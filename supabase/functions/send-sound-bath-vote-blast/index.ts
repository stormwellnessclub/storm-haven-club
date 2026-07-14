// Send Sound Bath member-vote email to all active members.
// Admin-only. Idempotent: dedupes on (email, template_key='sound_bath_vote_jul_2026') via email_audit_log.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_KEY = "sound_bath_vote_jul_2026";
const BASE_URL = "https://stormwellnessclub.com";
const FRIDAY_URL = `${BASE_URL}/member?vote=sound-bath-jul-2026&choice=friday_jul_24`;
const SATURDAY_URL = `${BASE_URL}/member?vote=sound-bath-jul-2026&choice=saturday_jul_25`;
const EITHER_URL = `${BASE_URL}/member?vote=sound-bath-jul-2026&choice=either`;

function buildHtml(firstName: string | null): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return `
    <div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
      <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
        <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display:block;margin:0 auto;" />
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
      <div style="background:#ffffff;padding:30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;color:#1C170F;">
        <p style="color:#a17e3a;font-family:Arial,sans-serif;letter-spacing:2px;font-size:11px;margin:0 0 8px;">MEMBER VOTE</p>
        <h1 style="font-family:Georgia,serif;font-weight:500;margin:0 0 6px;font-size:26px;line-height:1.25;">Sound Bath, Nervous System Reset &amp; Guided Meditation</h1>
        <p style="color:#88766B;margin:0 0 20px;">We're planning a 90-minute experience and would love for our members to help select the date.</p>

        <p>${greeting}</p>
        <p>Which evening do you prefer? Tap a button below to cast your vote — you can change it any time before voting closes.</p>

        <div style="text-align:center;margin:26px 0;">
          <a href="${FRIDAY_URL}" style="display:inline-block;background:#1C170F;color:#DEDACE;padding:14px 28px;text-decoration:none;border-radius:4px;font-weight:600;font-family:Georgia,serif;letter-spacing:0.5px;min-width:260px;">Friday, July 24 · 7:00 PM</a>
          <div style="height:12px;"></div>
          <a href="${SATURDAY_URL}" style="display:inline-block;background:#a17e3a;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:4px;font-weight:600;font-family:Georgia,serif;letter-spacing:0.5px;min-width:260px;">Saturday, July 25 · 7:00 PM</a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0;" />

        <h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 8px;">Tickets</h2>
        <p style="margin:0 0 16px;">Members: <strong>$30</strong> per person<br/>Non-Members: <strong>$40</strong> per person</p>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0;" />

        <h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 8px;">About the experience</h2>
        <p>Join us for a 90-minute nervous system reset led by <strong>Crystal Bell</strong>, a classically trained musician and yoga instructor. This restorative experience combines the healing frequencies of sound with the deep relaxation of guided meditation.</p>
        <p>The session will begin with breathwork and gentle stretching to prepare the mind and body to relax, release, and settle into stillness. Once grounded, attendees will be guided through a meditation designed to create a deeper state of relaxation and receptivity.</p>
        <p>The meditation will transition into an extended sound bath, where natural sound waves and healing vibrational frequencies will be used to release stress, encourage creativity, and restore energy throughout the body.</p>
        <p>Attendees are encouraged to bring a yoga mat, pillow, light blanket, eye mask, or anything else that will allow them to feel fully comfortable during the experience.</p>

        <p style="margin:28px 0 0;">With gratitude,<br/>The Storm Wellness Club Team</p>
      </div>
      <div style="background:#1C170F;padding:25px;text-align:center;color:#DEDACE;font-family:Georgia,serif;font-size:13px;">
        <p style="margin:0 0 6px 0;">Storm Wellness Club</p>
        <p style="margin:0;">Reply to this email or contact <a href="mailto:admin@stormwellnessclub.com" style="color:#DEDACE;">admin@stormwellnessclub.com</a></p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = await requireStaff(req, ["admin", "super_admin"]);
  if (!gate.ok) return gate.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const resend = new Resend(resendKey);

  // Fetch active members with email
  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status")
    .eq("status", "active");

  if (memErr) {
    return new Response(JSON.stringify({ error: memErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load already-sent emails for this template for dedupe
  const { data: sentRows } = await supabase
    .from("email_audit_log")
    .select("recipient_email")
    .eq("email_type", TEMPLATE_KEY);
  const alreadySent = new Set(
    (sentRows ?? []).map((r: any) => String(r.recipient_email || "").toLowerCase()),
  );

  let queued = 0;
  let skipped = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const m of members ?? []) {
    const email = String(m.email || "").trim().toLowerCase();
    if (!email || alreadySent.has(email)) {
      skipped++;
      continue;
    }
    try {
      const resp = await resend.emails.send({
        from: "Storm Wellness Club <admin@stormwellnessclub.com>",
        to: [email],
        subject: "Member Vote: Sound Bath & Nervous System Reset",
        html: buildHtml(m.first_name ?? null),
        reply_to: "admin@stormwellnessclub.com",
      });
      const status = (resp as any)?.error ? "failed" : "sent";
      await supabase.from("email_audit_log").insert({
        recipient_email: email,
        recipient_name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null,
        email_type: TEMPLATE_KEY,
        trigger_source: "admin_blast",
        triggered_by: gate.userId === "service_role" ? null : gate.userId,
        member_id: m.id,
        subject: "Member Vote: Sound Bath & Nervous System Reset",
        status,
        error_message: (resp as any)?.error?.message ?? null,
      });
      if (status === "sent") {
        queued++;
        alreadySent.add(email);
      } else {
        errors.push({ email, error: (resp as any)?.error?.message ?? "unknown" });
      }
    } catch (e: any) {
      errors.push({ email, error: e?.message ?? String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      queued,
      skipped,
      total_active: members?.length ?? 0,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
