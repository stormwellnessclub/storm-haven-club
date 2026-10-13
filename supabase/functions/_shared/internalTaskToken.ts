// Internal task token: how scheduled jobs prove to edge functions that they are
// internal callers.
//
// The token is generated inside the database and kept in the vault (secret name
// 'internal_task_token'). Scheduled jobs read it from the vault when they run;
// edge functions read it through the service-role-only RPC public.internal_task_token().
// It is never written in code, in the repo or in job definitions.
//
// The legacy INTERNAL_TASK_TOKEN environment secret is still accepted while jobs
// move over. Once every job uses the vault token, delete that secret: this code
// then accepts the vault token only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CACHE_MS = 5 * 60 * 1000;
let cached: { value: string | null; at: number } | null = null;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The token a caller presented, from any of the headers scheduled jobs use. */
export function presentedInternalToken(req: Request): string {
  return (
    req.headers.get("x-internal-task-token") ??
    req.headers.get("x-internal-token") ??
    req.headers.get("x-cron-secret") ??
    ""
  ).trim();
}

async function vaultToken(): Promise<string | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return null;
  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("internal_task_token");
    if (error) {
      console.error("[internalTaskToken] could not read vault token:", error.message);
      return cached?.value ?? null;
    }
    cached = { value: typeof data === "string" && data ? data : null, at: Date.now() };
    return cached.value;
  } catch (err) {
    console.error("[internalTaskToken] could not read vault token:", err);
    return cached?.value ?? null;
  }
}

/** True when `presented` is the vault token (or, until it is deleted, the legacy env token). */
export async function isValidInternalToken(presented: string): Promise<boolean> {
  if (!presented) return false;
  const fromVault = await vaultToken();
  if (fromVault && timingSafeEqual(presented, fromVault)) return true;
  const legacy = (Deno.env.get("INTERNAL_TASK_TOKEN") ?? "").trim();
  return !!legacy && timingSafeEqual(presented, legacy);
}
