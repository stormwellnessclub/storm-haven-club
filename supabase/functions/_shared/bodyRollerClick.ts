// Signed click-tracking links for Body Roller campaign emails.
const SITE_HOSTS = new Set(["stormwellnessclub.com", "www.stormwellnessclub.com"]);
const enc = new TextEncoder();
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export async function signClick(email: string, kind: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("BODY_ROLLER_CLICK_SECRET") ?? ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${email.toLowerCase()}|${kind}`)));
  return btoa(String.fromCharCode(...sig.slice(0, 16))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isSiteUrl = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && SITE_HOSTS.has(x.hostname); } catch { return false; } };

/** Rewrites every club link in the email so a click is recorded before redirecting. */
export async function trackLinks(html: string, email: string, kind: string): Promise<string> {
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/body-roller-click`;
  const s = await signClick(email, kind);
  const e = b64u(email.toLowerCase());
  return html.replace(/href="(https:\/\/[^"]+)"/g, (m, url) =>
    isSiteUrl(url) ? `href="${base}?e=${e}&k=${encodeURIComponent(kind)}&s=${s}&u=${b64u(url)}"` : m);
}
