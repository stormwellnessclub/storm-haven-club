import { detroitMidnightUnix } from "./freezePrePause.ts";

export function detroitDateISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function freezeStillInEffect(endDate: string | null, today: string, resumeDate?: string | null) {
  return !!endDate && endDate > today && !resumeDate;
}

/** Durable marker and identical key shared by early-end and scheduled workers. */
export async function resumeFreezeDues(stripe: any, subscriptionId: string, freezeId: string, resumeDate: string) {
  const marker = `freeze:${freezeId}`;
  const verify = (sub: any) => {
    if (sub.pause_collection || ["canceled", "incomplete_expired", "paused", "trialing"].includes(sub.status)) {
      throw new Error("Stripe has not confirmed resumed dues billing");
    }
    if (Number(sub.billing_cycle_anchor) < detroitMidnightUnix(resumeDate) || !sub.latest_invoice) {
      throw new Error("Stripe has not confirmed the new full-period billing anchor and invoice");
    }
    return sub;
  };
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (["canceled", "incomplete_expired", "paused"].includes(sub.status)) throw new Error(`Subscription is ${sub.status}`);
  if (sub.metadata?.storm_freeze_resume === marker) return verify(sub);
  const params: Record<string, unknown> = {
    pause_collection: "", proration_behavior: "none",
    metadata: { storm_freeze_resume: marker, storm_freeze_resume_date: resumeDate },
  };
  if (sub.status === "trialing" || Number(sub.trial_end) > Date.now() / 1000) params.trial_end = "now";
  else params.billing_cycle_anchor = "now";
  await stripe.subscriptions.update(subscriptionId, params, { idempotencyKey: `storm-freeze-resume-${freezeId}` });
  const verified = await stripe.subscriptions.retrieve(subscriptionId);
  if (verified.metadata?.storm_freeze_resume !== marker) throw new Error("Stripe resume marker was not confirmed");
  return verify(verified);
}

/** Prepare records intent once; finish commits both statuses in one database transaction. */
export async function completeFreezeBilling(db: any, stripe: any, freezeId: string, early: boolean) {
  const { data: intent, error } = await db.rpc("prepare_freeze_billing_resume", { p_freeze_id: freezeId, p_early: early });
  if (error) throw error;
  if (!intent || intent.completed) return { completed: false, alreadyCompleted: true };
  try {
    if (!intent.subscription_id) throw new Error("No dues subscription is linked; staff review is required before completing this freeze");
    const verified = await resumeFreezeDues(stripe, intent.subscription_id, freezeId, intent.resume_date);
    const { data: finished, error: finishError } = await db.rpc("finish_freeze_billing_resume", {
      p_freeze_id: freezeId, p_next_billing_date: detroitDateISO(new Date(Number(verified.items?.data?.[0]?.current_period_end ?? verified.current_period_end) * 1000)),
    });
    if (finishError) throw finishError;
    return { completed: finished === true, memberId: intent.member_id, resumeDate: intent.resume_date };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: recordError } = await db.from("member_freezes").update({ billing_resume_error: message }).eq("id", freezeId).eq("status", "active");
    if (recordError) console.error("Could not record freeze billing error", recordError.message);
    throw error;
  }
}