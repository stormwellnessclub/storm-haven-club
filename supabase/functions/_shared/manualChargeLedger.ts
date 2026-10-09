// Shared bookkeeping for card charges taken at the register / admin charge screens.
//
// A charge must land in `manual_charges` no matter which path took it:
//   - `charge_saved_card` / `charge_saved_card_with_3ds` record it directly when
//     Stripe confirms immediately;
//   - a charge that needs 3D Secure (or is still processing) is recorded as
//     'pending' and the `payment_intent.succeeded` / `payment_intent.payment_failed`
//     webhook finalizes it.
// Successful rows carry the same metadata failed rows always had (type, line
// items, subtotal, tax, fee) so reports never have to guess from description text.
//
// When the money is membership dues, `settleMembershipCollection` applies it to
// the member's arrears and stops Stripe from dunning the invoices it covered.

import Stripe from "https://esm.sh/stripe@18.5.0";

// deno-lint-ignore no-explicit-any
type Db = any;

export interface ManualChargeMetadata {
  type: string;
  payment_type?: string | null;
  line_items: Array<{ name: string; quantity: number; unit_price: number }>;
  subtotal_cents: number | null;
  tax_cents: number | null;
  processing_fee_cents: number | null;
  /** True when the charge pays membership dues / fees and should settle arrears. */
  membership_collection?: boolean;
  stripe_customer_id?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  [key: string]: unknown;
}

/** Resolve who a Stripe customer belongs to (member first, then non-member profile). */
export async function resolveStripeCustomerOwner(
  supabase: Db,
  stripeCustomerId: string,
): Promise<{ memberId: string | null; userId: string | null }> {
  const { data: m } = await supabase
    .from("members")
    .select("id, user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  if (m?.user_id) return { memberId: m.id, userId: m.user_id };

  const { data: nm } = await supabase
    .from("non_member_profiles")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (nm?.user_id) return { memberId: null, userId: nm.user_id };

  return { memberId: null, userId: null };
}

/** Membership money = dues, initiation/annual fees or explicit arrears collection. */
export function isMembershipCollection(opts: {
  description: string;
  chargeType?: string | null;
  settleArrears?: boolean;
}): boolean {
  const d = (opts.description || "").toLowerCase();
  return d.includes("dues") || d.includes("membership") ||
    d.includes("initiation") || d.includes("annual fee") || d.includes("past due") ||
    opts.chargeType === "membership_dues" || opts.settleArrears === true;
}

/**
 * Insert a manual_charges row for a card charge. Resolves the owner from the Stripe
 * customer when the caller only knew the customer id (register sales to non-members).
 * Idempotent on the payment intent: an existing row for the intent is updated instead.
 * Returns the row's owner so callers can settle arrears for members.
 */
export async function recordManualCharge(supabase: Db, opts: {
  memberId: string | null;
  userId: string | null;
  applicationId: string | null;
  stripeCustomerId: string | null;
  chargedByUserId: string | null;
  amountCents: number;
  description: string;
  note?: string | null;
  paymentIntentId: string;
  status: "succeeded" | "pending";
  metadata: ManualChargeMetadata;
}): Promise<{ id: string | null; memberId: string | null; recorded: boolean }> {
  let memberId = opts.memberId;
  let userId = opts.userId;
  const metadata: ManualChargeMetadata = { ...opts.metadata };

  if (!userId && !opts.applicationId && opts.stripeCustomerId) {
    const owner = await resolveStripeCustomerOwner(supabase, opts.stripeCustomerId);
    memberId = owner.memberId;
    userId = owner.userId;
    metadata.stripe_customer_id = opts.stripeCustomerId;
  }

  const base = {
    amount: opts.amountCents,
    description: opts.description,
    stripe_payment_intent_id: opts.paymentIntentId,
    status: opts.status,
    charged_by: opts.chargedByUserId,
    note: opts.note || null,
    metadata,
  };

  let row: Record<string, unknown>;
  if (userId) {
    row = { ...base, member_id: memberId, user_id: userId };
  } else if (opts.applicationId) {
    // Application charge (before a member record exists): the staff user owns the row.
    row = { ...base, application_id: opts.applicationId, user_id: opts.chargedByUserId };
  } else {
    // Recording under the staff user would surface it in their own payment history.
    console.error("[manualChargeLedger] charge NOT recorded: owner of Stripe customer could not be resolved", {
      stripeCustomerId: opts.stripeCustomerId,
      paymentIntentId: opts.paymentIntentId,
      amountCents: opts.amountCents,
    });
    return { id: null, memberId: null, recorded: false };
  }

  const updateExisting = async (existing: { id: string; status: string }) => {
    // Never downgrade a finalized row back to pending.
    const nextStatus = existing.status === "succeeded" ? "succeeded" : opts.status;
    const { error } = await supabase
      .from("manual_charges")
      .update({ ...row, status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) console.error("[manualChargeLedger] update failed", error.message);
    return { id: existing.id, memberId, recorded: !error };
  };

  const findExisting = async () => {
    const { data } = await supabase
      .from("manual_charges")
      .select("id, status")
      .eq("stripe_payment_intent_id", opts.paymentIntentId)
      .limit(1)
      .maybeSingle();
    return data as { id: string; status: string } | null;
  };

  const existing = await findExisting();
  if (existing) return updateExisting(existing);

  const { data: inserted, error } = await supabase
    .from("manual_charges")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    // The webhook and the charge function can race to record the same intent;
    // the unique index on stripe_payment_intent_id makes the loser update instead.
    if (error.code === "23505") {
      const raced = await findExisting();
      if (raced) return updateExisting(raced);
    }
    console.error("[manualChargeLedger] insert failed", error.message);
    return { id: null, memberId, recorded: false };
  }
  return { id: inserted?.id ?? null, memberId, recorded: true };
}

/**
 * Apply collected membership money to the member's arrears and mark the Stripe
 * invoices it covers as paid out of band so Stripe stops retrying them.
 * `amountCents` must exclude the card processing fee: the fee is not dues.
 */
export async function settleMembershipCollection(opts: {
  supabase: Db;
  stripe: Stripe;
  /** The manual_charges row holding the money; settlement is claimed on it exactly once. */
  manualChargeId: string;
  memberId: string;
  amountCents: number;
  note?: string | null;
  actorEmail?: string | null;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}): Promise<void> {
  const log = opts.log ?? ((msg: string, data?: Record<string, unknown>) => console.log(msg, data ?? ""));
  const { supabase, stripe, memberId } = opts;

  // Claim the charge so the charge function and the webhook can never both apply
  // the same money to arrears.
  const { data: claimed, error: claimErr } = await supabase
    .from("manual_charges")
    .update({ arrears_settled_at: new Date().toISOString() })
    .eq("id", opts.manualChargeId)
    .is("arrears_settled_at", null)
    .select("id");
  if (claimErr) {
    log("Warning: could not claim charge for arrears settlement", { error: claimErr.message });
    return;
  }
  if (!claimed || claimed.length === 0) {
    log("Arrears already settled for this charge", { manualChargeId: opts.manualChargeId });
    return;
  }

  const { data: settleRes, error: settleErr } = await supabase.rpc("settle_membership_dues_payment", {
    p_member_id: memberId,
    p_amount_cents: opts.amountCents,
    p_note: opts.note ? `Paid in club — ${opts.note}` : "Paid in club (manual charge)",
    p_actor_email: opts.actorEmail ?? null,
  });
  if (settleErr) {
    log("Warning: failed to settle arrears after charge", { error: settleErr.message });
    return;
  }
  log("Arrears settled from manual charge", { result: settleRes });

  // Stop Stripe from continuing to dun invoices we collected by hand.
  try {
    const { data: memberRow } = await supabase
      .from("members")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", memberId)
      .maybeSingle();
    const custIds = [memberRow?.stripe_customer_id].filter(Boolean) as string[];
    if (memberRow?.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(memberRow.stripe_subscription_id);
        const sc = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (sc && !custIds.includes(sc)) custIds.push(sc);
      } catch (_e) { /* subscription may be gone */ }
    }
    let remainingCents = opts.amountCents;
    for (const cid of custIds) {
      const open = await stripe.invoices.list({ customer: cid, status: "open", limit: 20 });
      // deno-lint-ignore no-explicit-any
      const oldestFirst = open.data.sort((a: any, b: any) => (a.created ?? 0) - (b.created ?? 0));
      for (const inv of oldestFirst) {
        if (remainingCents < (inv.amount_remaining ?? 0)) break;
        if (!inv.id) continue;
        await stripe.invoices.pay(inv.id, { paid_out_of_band: true });
        remainingCents -= inv.amount_remaining ?? 0;
        log("Marked Stripe invoice paid out of band", { invoiceId: inv.id });
      }
    }
  } catch (invErr) {
    log("Warning: could not settle Stripe invoices", { error: String(invErr) });
  }
}

/**
 * Webhook side: record or finalize the manual_charges row for a PaymentIntent the
 * charge screens created (tagged `ledger: 'manual_charges'`). Covers 3D Secure
 * completions and intents that confirmed after the charge request returned.
 */
export async function finalizeManualChargeFromIntent(opts: {
  supabase: Db;
  stripe: Stripe;
  paymentIntent: Stripe.PaymentIntent;
  outcome: "succeeded" | "failed";
  log?: (msg: string, data?: Record<string, unknown>) => void;
}): Promise<void> {
  const { supabase, stripe, paymentIntent: pi, outcome } = opts;
  const log = opts.log ?? ((msg: string, data?: Record<string, unknown>) => console.log(msg, data ?? ""));
  const md = pi.metadata || {};
  const toCents = (v: string | undefined) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const { data: existing } = await supabase
    .from("manual_charges")
    .select("id, status, member_id, metadata")
    .eq("stripe_payment_intent_id", pi.id)
    .limit(1)
    .maybeSingle();

  if (outcome === "failed") {
    // Synchronous declines are recorded by the charge function; here only a row
    // still waiting on the intent is closed out.
    if (existing && existing.status === "pending") {
      const err = pi.last_payment_error;
      await supabase
        .from("manual_charges")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            decline_code: err?.decline_code || err?.code || null,
            decline_reason: err?.message || "Payment failed",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      log("Pending manual charge marked failed", { paymentIntentId: pi.id });
    }
    return;
  }

  if (existing?.status === "succeeded") return;

  const membershipCollection = md.membership_collection === "true";
  const feeCents = toCents(md.processing_fee) ?? 0;
  const amountCents = pi.amount_received || pi.amount;
  let manualChargeId: string | null = existing?.id ?? null;
  let memberId: string | null = existing?.member_id ?? null;

  if (existing) {
    await supabase
      .from("manual_charges")
      .update({ status: "succeeded", failed_at: null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    log("Pending manual charge marked succeeded", { paymentIntentId: pi.id });
  } else {
    const mdMemberId = md.member_id && md.member_id !== "application" ? md.member_id : null;
    let userId: string | null = null;
    if (mdMemberId) {
      const { data: m } = await supabase.from("members").select("user_id").eq("id", mdMemberId).maybeSingle();
      userId = m?.user_id ?? null;
    }
    const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;
    const res = await recordManualCharge(supabase, {
      memberId: userId ? mdMemberId : null,
      userId,
      applicationId: md.application_id || null,
      stripeCustomerId: customerId,
      chargedByUserId: md.charged_by || null,
      amountCents,
      description: pi.description || "Card charge",
      paymentIntentId: pi.id,
      status: "succeeded",
      metadata: {
        type: md.type || "manual_charge",
        payment_type: md.payment_type || null,
        line_items: [],
        subtotal_cents: toCents(md.subtotal),
        tax_cents: toCents(md.tax_amount),
        processing_fee_cents: feeCents,
        membership_collection: membershipCollection,
        recorded_by: "payment_intent_webhook",
      },
    });
    manualChargeId = res.id;
    memberId = res.memberId;
    log("Manual charge recorded from payment_intent.succeeded", { paymentIntentId: pi.id, recorded: res.recorded });
  }

  if (membershipCollection && memberId && manualChargeId) {
    await settleMembershipCollection({
      supabase,
      stripe,
      manualChargeId,
      memberId,
      amountCents: amountCents - feeCents,
      note: "Card charge confirmed",
      log,
    });
  }
}
