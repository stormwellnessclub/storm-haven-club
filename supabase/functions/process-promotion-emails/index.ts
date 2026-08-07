// Promotion (class pass sale) emails.
// Actions:
//   preview  -> returns rendered HTML for a job/promotion (staff)
//   test     -> sends a single test email (staff)
//   send     -> sends a queued job immediately (staff)
//   process  -> cron: sends every pending job whose scheduled_for has passed
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://stormwellnessclub.com";
const FROM = "Storm Wellness Club <admin@stormwellnessclub.com>";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Detroit",
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function buildHtml(opts: {
  firstName: string | null;
  body: string;
  promoName: string;
  promoCode: string | null;
  discountLabel: string;
  endsAt: string;
}): string {
  const greeting = opts.firstName ? `Hi ${esc(opts.firstName)},` : "Hello,";
  const paragraphs = String(opts.body || "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const codeBlock = opts.promoCode
    ? `<div style="text-align:center;margin:8px 0 24px;">
         <div style="display:inline-block;border:2px dashed #B8A068;padding:14px 26px;border-radius:8px;background:#F7F4EC;">
           <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#a17e3a;margin-bottom:6px;">USE CODE</div>
           <div style="font-family:Georgia,serif;font-size:24px;letter-spacing:3px;color:#1C170F;">${esc(opts.promoCode)}</div>
         </div>
       </div>`
    : "";

  return `
    <div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;">
      <div style="background:#DEDACE;padding:36px 30px;text-align:center;">
        <div style="font-size:22px;letter-spacing:2px;color:#1C170F;">STORM WELLNESS CLUB</div>
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
      <div style="background:#ffffff;padding:32px 30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;color:#1C170F;">
        <p style="color:#a17e3a;font-family:Arial,sans-serif;letter-spacing:2px;font-size:11px;margin:0 0 8px;">CLASS PASS SALE</p>
        <h1 style="font-weight:500;margin:0 0 6px;font-size:26px;line-height:1.25;">${esc(opts.promoName)}</h1>
        <p style="color:#88766B;margin:0 0 22px;font-style:italic;">${esc(opts.discountLabel)} &middot; ends ${esc(fmtDate(opts.endsAt))}</p>
        <p style="margin:0 0 16px;">${greeting}</p>
        ${paragraphs}
        ${codeBlock}
        <div style="text-align:center;margin:26px 0 8px;">
          <a href="${BASE_URL}/class-passes" style="background:#1C170F;color:#DEDACE;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:15px;display:inline-block;">Buy Class Passes</a>
        </div>
        <p style="margin:28px 0 0;">Warmly,<br/><strong>The Storm Wellness Club Team</strong></p>
      </div>
      <div style="background:#1C170F;padding:24px;text-align:center;color:#DEDACE;font-size:13px;">
        <p style="margin:0 0 6px;">Storm Wellness Club</p>
        <p style="margin:0;">Questions? <a href="mailto:admin@stormwellnessclub.com" style="color:#DEDACE;">admin@stormwellnessclub.com</a></p>
      </div>
    </div>`;
}

function discountLabel(p: any): string {
  return p.discount_type === "percent" ? `${Number(p.discount_value)}% off` : `$${Number(p.discount_value).toFixed(2)} off`;
}

type Recipient = { email: string; firstName: string | null; name: string | null; memberId: string | null };

async function loadRecipients(supabase: any, audience: string): Promise<Recipient[]> {
  const out = new Map<string, Recipient>();

  const wantMembers = audience === "members" || audience === "members_and_nonmembers" || audience === "all";
  const wantNonMembers = audience === "non_members" || audience === "members_and_nonmembers" || audience === "all";

  if (wantMembers) {
    const { data } = await supabase
      .from("members")
      .select("id, first_name, last_name, email")
      .eq("status", "active");
    for (const m of data ?? []) {
      const email = String(m.email || "").trim().toLowerCase();
      if (!email) continue;
      out.set(email, {
        email,
        firstName: m.first_name ?? null,
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || null,
        memberId: m.id,
      });
    }
  }

  if (wantNonMembers) {
    const { data } = await supabase
      .from("non_member_profiles")
      .select("email, first_name, last_name");
    for (const n of data ?? []) {
      const email = String(n.email || "").trim().toLowerCase();
      if (!email || out.has(email)) continue;
      out.set(email, {
        email,
        firstName: n.first_name ?? null,
        name: [n.first_name, n.last_name].filter(Boolean).join(" ") || null,
        memberId: null,
      });
    }
  }

  // Never email suppressed / blocked addresses
  try {
    const { data: blocked } = await supabase.from("blocked_persons").select("email");
    for (const b of blocked ?? []) {
      const e = String(b.email || "").trim().toLowerCase();
      if (e) out.delete(e);
    }
  } catch { /* table optional */ }

  try {
    const { data: unsub } = await supabase
      .from("marketing_contacts")
      .select("email, unsubscribed_at, opted_in_email")
      .or("unsubscribed_at.not.is.null,opted_in_email.eq.false");
    for (const u of unsub ?? []) {
      const e = String(u.email || "").trim().toLowerCase();
      if (e) out.delete(e);
    }
  } catch { /* column optional */ }

  return Array.from(out.values());
}

async function sendJob(supabase: any, resend: Resend, job: any): Promise<{ sent: number; failed: number }> {
  const { data: promo } = await supabase.from("promotions").select("*").eq("id", job.promotion_id).maybeSingle();
  if (!promo) throw new Error("Sale not found");

  // Skip if the sale was cancelled or already over
  if (promo.status === "cancelled" || new Date(promo.ends_at).getTime() < Date.now()) {
    await supabase.from("promotion_email_jobs").update({
      status: "cancelled",
      error_message: "Sale cancelled or already ended",
    }).eq("id", job.id);
    return { sent: 0, failed: 0 };
  }

  await supabase.from("promotion_email_jobs").update({ status: "sending" }).eq("id", job.id);

  const recipients = await loadRecipients(supabase, job.audience);
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      const html = buildHtml({
        firstName: r.firstName,
        body: job.body,
        promoName: promo.name,
        promoCode: promo.promo_code,
        discountLabel: discountLabel(promo),
        endsAt: promo.ends_at,
      });
      const resp = await resend.emails.send({
        from: FROM,
        to: [r.email],
        subject: job.subject,
        html,
        reply_to: "admin@stormwellnessclub.com",
      });
      const status = (resp as any)?.error ? "failed" : "sent";
      if (status === "sent") sent++; else failed++;
      await supabase.from("email_audit_log").insert({
        recipient_email: r.email,
        recipient_name: r.name,
        email_type: `promotion_${job.kind}`,
        trigger_source: "promotion_email",
        member_id: r.memberId,
        subject: job.subject,
        status,
        error_message: (resp as any)?.error?.message ?? null,
      });
    } catch (_e) {
      failed++;
    }
  }

  await supabase.from("promotion_email_jobs").update({
    status: "sent",
    sent_count: sent,
    failed_count: failed,
    sent_at: new Date().toISOString(),
  }).eq("id", job.id);

  return { sent, failed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body?.action ?? "process";

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (action !== "process") {
    const gate = await requireStaff(req, ["admin", "super_admin"]);
    if (!gate.ok) return gate.response;
  } else {
    const gate = await requireTrustedCaller(req, ["admin", "super_admin"]);
    if (!gate.ok) return gate.response;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (action === "preview") {
      const { data: promo } = await supabase.from("promotions").select("*").eq("id", body.promotionId).maybeSingle();
      if (!promo) return json({ error: "Sale not found" }, 404);
      const html = buildHtml({
        firstName: "Jane",
        body: body.body ?? "",
        promoName: promo.name,
        promoCode: promo.promo_code,
        discountLabel: discountLabel(promo),
        endsAt: promo.ends_at,
      });
      return new Response(html, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const resend = new Resend(resendKey);

    if (action === "test") {
      const { data: promo } = await supabase.from("promotions").select("*").eq("id", body.promotionId).maybeSingle();
      if (!promo) return json({ error: "Sale not found" }, 404);
      const to = String(body.testEmail || "").trim().toLowerCase();
      if (!to) return json({ error: "testEmail is required" }, 400);
      const resp = await resend.emails.send({
        from: FROM,
        to: [to],
        subject: `[TEST] ${body.subject ?? promo.name}`,
        html: buildHtml({
          firstName: "Jane",
          body: body.body ?? "",
          promoName: promo.name,
          promoCode: promo.promo_code,
          discountLabel: discountLabel(promo),
          endsAt: promo.ends_at,
        }),
        reply_to: "admin@stormwellnessclub.com",
      });
      if ((resp as any)?.error) return json({ ok: false, error: (resp as any).error.message }, 500);
      return json({ ok: true, sentTo: to });
    }

    if (action === "send") {
      const { data: job } = await supabase
        .from("promotion_email_jobs")
        .select("*")
        .eq("id", body.jobId)
        .maybeSingle();
      if (!job) return json({ error: "Email not found" }, 404);
      if (job.status === "sent") return json({ error: "This email was already sent" }, 400);
      const result = await sendJob(supabase, resend, job);
      return json({ ok: true, ...result });
    }

    // process: cron
    const { data: due } = await supabase
      .from("promotion_email_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(10);

    let totalSent = 0;
    let totalFailed = 0;
    for (const job of due ?? []) {
      try {
        const r = await sendJob(supabase, resend, job);
        totalSent += r.sent;
        totalFailed += r.failed;
      } catch (e: any) {
        await supabase.from("promotion_email_jobs").update({
          status: "failed",
          error_message: e?.message ?? String(e),
        }).eq("id", job.id);
      }
    }

    return json({ ok: true, processed: due?.length ?? 0, sent: totalSent, failed: totalFailed });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
