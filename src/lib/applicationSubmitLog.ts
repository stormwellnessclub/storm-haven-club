/**
 * Server-side breadcrumb for membership application submits.
 *
 * The application row is written at the very last step of the apply flow. If
 * that insert fails (network drop, RLS error, tab closed mid-submit) there was
 * previously no record anywhere that the person had pressed Submit. These
 * helpers log a `pending` attempt before the insert and the outcome after, via
 * an edge function with a service-role client so an insert failure can't also
 * swallow the log.
 *
 * If the log call itself fails, the call is queued in localStorage and flushed
 * the next time the apply page loads.
 */
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "swc:application-submit-log-queue";
const FN = "log-application-submit";

type LogBody = Record<string, unknown>;

function queue(body: LogBody) {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const items: LogBody[] = raw ? JSON.parse(raw) : [];
    items.push(body);
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-10)));
  } catch {
    /* private mode / quota — nothing else we can do */
  }
}

async function send(body: LogBody, allowQueue = true) {
  try {
    const { error } = await supabase.functions.invoke(FN, { body });
    if (error) throw error;
  } catch (err) {
    console.warn("[application-submit-log] failed", err);
    if (allowQueue) queue(body);
  }
}

function randomUuidFallback(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Stable per-submit key so start/result pair up and retries stay idempotent. */
export function newSubmitKey(email: string): string {
  // The random part is what proves a later "result" call came from the same
  // browser that started the attempt, so it must always be a full random UUID.
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : randomUuidFallback();
  return `${email.trim().toLowerCase().slice(0, 60)}:${Date.now()}:${rand}`;
}

export async function logSubmitStart(args: {
  clientKey: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  payload: unknown;
}) {
  await send({ phase: "start", ...args });
}

export async function logSubmitResult(args: {
  clientKey: string;
  status: "succeeded" | "failed";
  error?: string;
  applicationId?: string;
}) {
  await send({ phase: "result", ...args });
}

/** Flush anything that couldn't be logged on a previous visit. */
export async function flushSubmitLogQueue() {
  let items: LogBody[] = [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    items = JSON.parse(raw);
    window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    return;
  }
  for (const item of items) {
    await send(item, false);
  }
}

/** The database refused a second pending application for the same email. */
export function isDuplicateApplicationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" || /membership_applications_one_pending_per_email/.test(error.message ?? "");
}
