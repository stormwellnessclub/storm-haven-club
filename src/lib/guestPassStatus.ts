/**
 * Guest pass check-in helpers.
 *
 * Historically two different strings were read as a guest check-in, but the
 * guest_passes constraint only permits `exhausted` as the completed state.
 * Treat legacy `used` values as checked in when reading and always write the
 * valid canonical state so a check-in cannot fail or lose its date.
 */
import { clubTodayDateStr } from "@/lib/clubTime";

export const CHECKED_IN_STATUSES = ["used", "exhausted"] as const;

/**
 * Every guest_passes column readable by signed-in users.
 * `card_exp_month`, `card_exp_year` and `feedback_token` are intentionally
 * excluded — the Data API grant withholds them, so `select("*")` fails.
 */
export const GUEST_PASS_COLUMNS = [
  "id",
  "user_id",
  "guest_name",
  "guest_email",
  "phone_number",
  "guest_gender",
  "member_referral",
  "referring_member_id",
  "status",
  "valid_date",
  "used_at",
  "expires_at",
  "purchased_at",
  "created_at",
  "price_paid",
  "payment_method",
  "stripe_customer_id",
  "stripe_payment_id",
  "card_brand",
  "card_last4",
  "sold_by",
  "checked_in_by",
  "no_show",
  "admin_notes",
  "visit_notes",
  "visit_interests",
  "add_ons",
  "follow_up_status",
  "follow_up_notes",
  "feedback_email_sent_at",
].join(", ") as unknown as "*";

export function isGuestPassCheckedIn(pass: {
  status?: string | null;
  used_at?: string | null;
}): boolean {
  if (pass.used_at) return true;
  return CHECKED_IN_STATUSES.includes((pass.status || "") as any);
}

/**
 * Canonical field set written on every guest pass check-in.
 */
export function guestCheckInPatch(checkedInBy?: string | null) {
  return {
    status: "exhausted",
    used_at: new Date().toISOString(),
    valid_date: clubTodayDateStr(),
    checked_in_by: checkedInBy ?? null,
  };
}

/**
 * Check a guest in through the staff-guarded server function.
 *
 * Direct table updates only work for the four roles named in the RLS policy and
 * silently affect zero rows for every other staff role, so always go through
 * the RPC and fall back to a direct update only if the RPC is unavailable.
 */
export async function checkInGuestPass(
  supabase: any,
  passId: string,
  checkedInBy?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("kiosk_check_in_guest", {
    p_guest_pass_id: passId,
  });

  if (!error) {
    if (data?.success) return { ok: true };
    return { ok: false, error: data?.error || "Guest check-in failed" };
  }

  // RPC unavailable/not permitted — try the direct update as a fallback.
  const { data: rows, error: updErr } = await supabase
    .from("guest_passes")
    .update(guestCheckInPatch(checkedInBy))
    .eq("id", passId)
    .select("id");

  if (updErr) return { ok: false, error: updErr.message };
  if (!rows || rows.length === 0) {
    return {
      ok: false,
      error: "Not permitted to check in this guest — your staff account is missing check-in access.",
    };
  }
  return { ok: true };
}


/**
 * Never render an empty date cell. Falls back valid_date -> purchase date.
 */
export function guestVisitDateLabel(pass: {
  used_at?: string | null;
  valid_date?: string | null;
  purchased_at?: string | null;
}): string {
  if (pass.used_at) {
    return new Date(pass.used_at).toLocaleString("en-US", {
      timeZone: "America/Detroit",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (pass.valid_date) {
    return new Date(`${pass.valid_date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (pass.purchased_at) {
    return `${new Date(pass.purchased_at).toLocaleDateString("en-US", {
      timeZone: "America/Detroit",
      month: "short",
      day: "numeric",
      year: "numeric",
    })} (purchase date)`;
  }
  return "Date not recorded";
}
