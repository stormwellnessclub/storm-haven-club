// Tells a client (email + consent-checked text) that staff offered a different PT time.
// Staff-only; one message per offer via idempotency on the offer timestamp.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const FROM = "Storm Wellness Club <hello@stormwellnessclub.com>";
const SITE = "https://stormwellnessclub.com";
const STAFF = ["super_admin", "admin", "manager", "front_desk"];
const UUID_RE = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Unauthorized" }, 401);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).in("role", STAFF);
  if (!roles?.length) return json({ error: "Forbidden" }, 403);

  try {
    const { request_id } = await req.json();
    if (typeof request_id !== "string" || !UUID_RE.test(request_id)) return json({ error: "request_id required" }, 400);
    const { data: r } = await admin.from("training_requests")
      .select("id, client_user_id, email, full_name, service, request_status, alt_date, alt_time, alt_trainer_id, offered_at")
      .eq("id", request_id).maybeSingle();
    if (!r || r.request_status !== "alternate_offered" || !r.alt_date || !r.alt_time) {
      return json({ success: false, error: "No alternate time is waiting on this request" });
    }
    let trainer = "your trainer";
    if (r.alt_trainer_id) {
      const { data: i } = await admin.from("instructors").select("first_name,last_name").eq("id", r.alt_trainer_id).maybeSingle();
      if (i) trainer = `${i.first_name ?? ""} ${i.last_name ?? ""}`.trim() || trainer;
    }
    const d = new Date(`${r.alt_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
    const [h, m] = String(r.alt_time).split(":").map(Number);
    const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    const first = String(r.full_name ?? "").split(" ")[0] || "there";
    const key = `pt-request-alt-${r.id}-${r.offered_at ?? ""}`;

    let smsWarning = false;
    if (r.client_user_id) {
      const { error } = await admin.functions.invoke("send-sms", { body: {
        to: { userId: r.client_user_id }, templateKey: "admin-custom",
        variables: { customBody: `Storm Wellness Club: Your requested PT time isn't available. We can offer ${d} at ${t} with ${trainer}. Reply here or call us to confirm. Reply STOP to opt out.` },
        idempotencyKey: key, metadata: { source: "send-pt-request-update", request_id: r.id },
      } });
      if (error) smsWarning = true;
    }
    if (!r.email) return json({ success: !smsWarning, sms_warning: smsWarning, email_warning: true });
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: e } = await resend.emails.send({ from: FROM, to: [r.email], subject: "A new time for your Personal Training request",
      headers: { "Idempotency-Key": key },
      html: `<div style="font-family:Georgia,serif;background:#ece2d2;padding:40px 20px;color:#3a2e1a;"><div style="max-width:520px;margin:0 auto;background:#f7f1e7;padding:32px;">
<p>Hi ${first},</p><p>Your requested Personal Training time isn't available. We'd like to offer:</p>
<p style="font-size:18px;"><strong>${d} at ${t}</strong><br/>with ${trainer}</p>
<p>This time isn't booked yet. Reply to this email or call the front desk to confirm, and we'll lock it in.</p>
<p><a href="${SITE}/member/personal-training" style="color:#5a3e2b;">View your requests</a></p>
<p>The Storm Wellness Club Team</p></div></div>` });
    return json({ success: !e, sms_warning: smsWarning, email_warning: !!e });
  } catch (err: any) {
    return json({ success: false, error: err?.message ?? String(err) });
  }
});
