// Campaign Studio email tracking: signed open pixel + signed click redirects (club links only),
// plus a plain-text version of each email. Signatures use the existing unsubscribe secret with a
// "track|" prefix so tracking links can't be forged to inflate results.
const SITE_HOSTS = new Set(["stormwellnessclub.com", "www.stormwellnessclub.com"]);
const enc = new TextEncoder();
export const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
export const isSiteUrl = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && SITE_HOSTS.has(x.hostname); } catch { return false; } };

export async function signTrack(campaignId: string, email: string): Promise<string> {
  const secret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET");
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET missing");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`track|${campaignId}|${email.trim().toLowerCase()}`)));
  return btoa(String.fromCharCode(...sig.slice(0, 16))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Rewrites club links so a click is recorded, then the person lands on the same page. Unsubscribe/mailto links are untouched. */
export async function addCampaignTracking(html: string, campaignId: string, email: string): Promise<string> {
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/campaign-track`;
  const s = await signTrack(campaignId, email);
  const e = b64u(email.trim().toLowerCase());
  const q = `c=${campaignId}&e=${e}&s=${s}`;
  let out = html.replace(/href="(https:\/\/[^"]+)"/g, (m, url) => {
    const real = url.replace(/&amp;/g, "&");
    return isSiteUrl(real) ? `href="${base}?t=c&${q}&u=${b64u(real)}"` : m;
  });
  const img = `<img src="${base}?t=o&${q}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${img}</body>`) : out + img;
  return out;
}

/** Plain-text twin of an HTML email (spam filters distrust image-only, HTML-only mail). */
export function htmlToText(html: string): string {
  return html
    .replace(/<div[^>]*display:none[^>]*>[\s\S]*?<\/div>/i, "")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (_m, alt) => (alt ? `\n${alt}\n` : ""))
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const t = label.replace(/<[^>]+>/g, "").trim();
      return t && !/^https?:/.test(t) ? `${t}: ${href.replace(/&amp;/g, "&")}` : href.replace(/&amp;/g, "&");
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|tr|table)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
