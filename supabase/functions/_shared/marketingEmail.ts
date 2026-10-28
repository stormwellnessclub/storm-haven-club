// Shared rules for every MARKETING email (campaigns, promotions, presale blasts).
// Receipts, bookings and account emails must never use this.
// - Per-person unsubscribe link that never expires (HMAC over the lowercased email).
// - RFC 8058 one-click List-Unsubscribe headers (recorded automatically, never emailed to admin@).
// - Club mailing address in the footer (CAN-SPAM).
// - One skip rule: unsubscribed / email opt-out (incl. bounced & spam-reported) / blocked.

export const CLUB_ADDRESS = "Storm Wellness Club · 18340 Middlebelt Rd, Livonia, MI 48152";
export const UNSUB_PLACEHOLDER = "%%UNSUB_URL%%";

const enc = new TextEncoder();
const norm = (e: string) => String(e || "").trim().toLowerCase();

async function hmac(email: string): Promise<string> {
  const secret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET");
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET missing");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(norm(email))));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function verifyUnsubToken(email: string, token: string): Promise<boolean> {
  if (!email || !token) return false;
  const expected = await hmac(email);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function unsubscribeUrl(email: string): Promise<string> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SUPABASE_URL missing");
  return `${base}/functions/v1/email-unsubscribe?e=${encodeURIComponent(norm(email))}&t=${await hmac(email)}`;
}

export async function marketingHeaders(email: string): Promise<Record<string, string>> {
  return {
    "List-Unsubscribe": `<${await unsubscribeUrl(email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function footerBlock(url: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:18px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8F7C70;">
${CLUB_ADDRESS}<br/>You're receiving this because you joined the Storm Wellness Club list.
<a href="${url}" style="color:#8F7C70;text-decoration:underline;">Unsubscribe</a></td></tr></table>`;
}

/** Fills the unsubscribe placeholder if the template has one, otherwise appends the standard footer. */
export async function withMarketingFooter(html: string, email: string): Promise<string> {
  const url = await unsubscribeUrl(email);
  if (html.includes(UNSUB_PLACEHOLDER)) return html.split(UNSUB_PLACEHOLDER).join(url);
  const block = footerBlock(url);
  return html.includes("</body>") ? html.replace("</body>", `${block}</body>`) : html + block;
}

export function marketingText(text: string, url: string) {
  return `${text}\n\n${CLUB_ADDRESS}\nUnsubscribe: ${url}`;
}

async function pageEmails(supabase: any, table: string, apply: (q: any) => any): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(supabase.from(table).select("email")).range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (r.email) out.push(norm(r.email));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every address marketing must skip. Paged — no 1,000-row cap. */
export async function loadSuppressedEmails(supabase: any): Promise<Set<string>> {
  const [unsub, optout, blocked] = await Promise.all([
    pageEmails(supabase, "marketing_contacts", (q) => q.not("unsubscribed_at", "is", null)),
    pageEmails(supabase, "marketing_contacts", (q) => q.eq("opted_in_email", false)),
    pageEmails(supabase, "blocked_persons", (q) => q),
  ]);
  return new Set([...unsub, ...optout, ...blocked]);
}

export async function isSuppressed(supabase: any, email: string): Promise<boolean> {
  const e = norm(email);
  const [{ data: mc, error: mcError }, { data: bl, error: blError }] = await Promise.all([
    supabase.from("marketing_contacts").select("id").ilike("email", e).or("unsubscribed_at.not.is.null,opted_in_email.eq.false").limit(1),
    supabase.from("blocked_persons").select("id").ilike("email", e).limit(1),
  ]);
  if (mcError || blError) throw new Error("Could not verify marketing email consent");
  return (mc?.length ?? 0) > 0 || (bl?.length ?? 0) > 0;
}

/** Legacy blasts share the same consent gate and system unsubscribe path as campaigns. */
export async function sendMarketingEmail(supabase: any, resend: any, message: any) {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (recipients.length !== 1 || !recipients[0]) throw new Error("Marketing emails require one recipient");
  const email = norm(recipients[0]);
  if (await isSuppressed(supabase, email)) {
    return { data: null, error: { message: "Recipient has unsubscribed from marketing" }, skipped: true };
  }
  const headers = await marketingHeaders(email);
  return resend.emails.send({
    ...message,
    to: [email],
    html: await withMarketingFooter(message.html, email),
    ...(message.text ? { text: marketingText(message.text, await unsubscribeUrl(email)) } : {}),
    headers: { ...message.headers, ...headers },
  });
}
