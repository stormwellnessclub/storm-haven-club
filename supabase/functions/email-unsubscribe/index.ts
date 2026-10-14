// Public one-click unsubscribe (RFC 8058) + confirmation page with Resubscribe.
// Links never expire; the HMAC token proves the link was issued for that email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubToken } from "../_shared/marketingEmail.ts";

const page = (title: string, body: string) => new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;background:#1C170F;font-family:Georgia,serif;color:#F4EFE6;">
<div style="max-width:520px;margin:12vh auto;padding:40px 28px;text-align:center;">
<p style="letter-spacing:6px;font-size:13px;color:#C9A96E;margin:0 0 28px;">STORM WELLNESS CLUB</p>
<h1 style="font-weight:normal;font-size:26px;margin:0 0 16px;">${title}</h1>${body}
<p style="font-family:Arial,sans-serif;font-size:11px;color:#8F7C70;margin-top:40px;">18340 Middlebelt Rd, Livonia, MI 48152</p></div></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("t") || "");
  const action = url.searchParams.get("a"); // "resub" for resubscribe
  if (email.length > 320 || !(await verifyUnsubToken(email, token))) {
    return page("This link isn't valid", `<p style="font-family:Arial,sans-serif;font-size:14px;color:#CFC6B8;">Reply to any of our emails and we'll take care of it.</p>`);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const self = `${url.origin}${url.pathname}?e=${encodeURIComponent(email)}&t=${token}`;

  // GET without action only shows a confirm button (mail scanners prefetch links).
  if (req.method === "GET" && !action) {
    return page("Unsubscribe from our emails?", `<form method="POST" action="${self}"><button style="background:#C9A96E;color:#1C170F;border:0;padding:14px 30px;letter-spacing:3px;font-size:12px;cursor:pointer;">UNSUBSCRIBE</button></form>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#CFC6B8;margin-top:18px;">${email}</p>`);
  }

  if (action === "resub" && req.method === "POST") {
    await db.from("marketing_contacts").update({ unsubscribed_at: null, opted_in_email: true }).ilike("email", email);
    return page("You're back on the list", `<p style="font-family:Arial,sans-serif;font-size:14px;color:#CFC6B8;">Welcome back. You'll receive our emails again.</p>`);
  }

  // POST (one-click from inbox, or the confirm button): opt out every record with this email.
  const now = new Date().toISOString();
  const { data: rows } = await db.from("marketing_contacts").select("id").ilike("email", email);
  if (rows && rows.length) {
    await db.from("marketing_contacts").update({ unsubscribed_at: now, opted_in_email: false }).ilike("email", email);
  } else {
    await db.from("marketing_contacts").insert({ email, source: "manual", source_label: "Unsubscribed via email link", opted_in_email: false, unsubscribed_at: now });
  }
  return page("You've been unsubscribed", `<p style="font-family:Arial,sans-serif;font-size:14px;color:#CFC6B8;">${email} won't receive marketing emails from Storm Wellness Club. Receipts and booking emails still arrive.</p>
<form method="POST" action="${self}&a=resub"><button style="background:transparent;color:#C9A96E;border:1px solid #C9A96E;padding:12px 26px;letter-spacing:3px;font-size:11px;cursor:pointer;margin-top:18px;">RESUBSCRIBE</button></form>`);
});
