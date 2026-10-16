export type SpaPaymentKind = "prepaid_online" | "paid_card" | "paid_desk" | "no_charge" | "unpaid";

export interface SpaPaymentState {
  kind: SpaPaymentKind;
  /** Money already collected for this appointment (0 if none) */
  paid: number;
  label: string;
}

/**
 * Decide what has actually been collected for a spa appointment.
 * A card on file alone never counts as paid — only a recorded amount does.
 */
export function getSpaPaymentState(appt: any): SpaPaymentState {
  const paid = Math.round((Number(appt?.amount_paid) || 0) * 100) / 100;
  const method = String(appt?.payment_method || "");
  if (method === "no_charge") return { kind: "no_charge", paid: 0, label: "No charge" };
  if (paid <= 0) return { kind: "unpaid", paid: 0, label: "Not paid" };
  const amt = `$${paid.toFixed(2)}`;
  if (appt?.payment_intent_id && method !== "cash" && method !== "other") {
    if (appt?.status !== "completed") {
      return { kind: "prepaid_online", paid, label: `Prepaid · ${amt}` };
    }
    return { kind: "paid_card", paid, label: `Paid by card · ${amt}` };
  }
  return { kind: "paid_desk", paid, label: `Paid at desk · ${amt}` };
}

/** Amount still to collect after what was already paid. Never negative. */
export function spaBalanceDue(newTotal: number, alreadyPaid: number): number {
  return Math.max(0, Math.round((newTotal - alreadyPaid) * 100) / 100);
}
