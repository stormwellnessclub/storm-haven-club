// Shared security helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/** Escape a value for safe interpolation into HTML email templates. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mask an email for logs: "jane@example.com" -> "j***@example.com". */
export function maskEmail(email: unknown): string {
  const s = String(email ?? "");
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  return `${s[0]}***${s.slice(at)}`;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** True when the caller is another server (service-role key or internal task token). */
export function isServerCaller(req: Request): boolean {
  const internal = Deno.env.get("INTERNAL_TASK_TOKEN") ?? "";
  const presented =
    req.headers.get("x-internal-task-token") ?? req.headers.get("x-internal-token") ?? "";
  if (internal && presented && safeEqual(presented, internal)) return true;
  const raw = req.headers.get("Authorization") ?? "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!serviceKey && !!token && safeEqual(token, serviceKey);
}

/** Resolve the signed-in user from the request JWT (null for anon/public keys). */
export async function getSignedInUser(
  req: Request,
): Promise<{ id: string; email: string } | null> {
  const raw = req.headers.get("Authorization") ?? "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: (data.user.email ?? "").toLowerCase() };
}

const ALLOWED_ORIGINS = [
  "https://stormwellnessclub.com",
  "https://www.stormwellnessclub.com",
  "https://storm-haven-club.lovable.app",
];
const DEFAULT_ORIGIN = "https://stormwellnessclub.com";

/** Return the request Origin only if it is a trusted site origin; otherwise the primary domain. */
export function trustedOrigin(req: Request): string {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return DEFAULT_ORIGIN;
}

/** Recipients allowed for admin "send test" emails: club addresses or the caller's own email. */
export async function isAllowedTestRecipient(req: Request, email: string): Promise<boolean> {
  const e = String(email || "").trim().toLowerCase();
  if (e.endsWith("@stormwellnessclub.com")) return true;
  const user = await getSignedInUser(req);
  return !!user && user.email === e;
}
