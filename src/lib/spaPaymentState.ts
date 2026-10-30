export type SpaPaymentKind = "prepaid_online" | "paid_card" | "paid_desk" | "no_charge" | "covered" | "unpaid";

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
  // Vouchers, gift cards and wellness credits cover the booked service; no further money is due for it.
  if (method === "mothers_day_voucher" || method === "credit" || method === "gift_card") {
    // Legacy credit amount_paid is service value, not collected extras.
    const extrasPaid = Math.max(0, Number(appt?.covered_checkout?.amount_paid) || 0);
    const label = method === "credit" ? "Covered · Credit" : method === "gift_card" ? "Covered · Gift card" : "Covered · Mother's Day voucher";
    return { kind: "covered", paid: extrasPaid, label };
  }
  if (paid <= 0) return { kind: "unpaid", paid: 0, label: "Not paid" };
  // Older self-bookings saved the price as amount_paid without collecting it.
  // Only explicit desk tenders or a card payment reference prove collection.
  const deskTender = ["cash", "check", "other"].includes(method);
  if (!deskTender && !appt?.payment_intent_id) {
    return { kind: "unpaid", paid: 0, label: "Not paid" };
  }
  const amt = `$${paid.toFixed(2)}`;
  if (appt?.payment_intent_id && !deskTender) {
    if (appt?.status !== "completed") {
      return { kind: "prepaid_online", paid, label: `Prepaid · ${amt}` };
    }
    return { kind: "paid_card", paid, label: `Paid by card · ${amt}` };
  }
  return { kind: "paid_desk", paid, label: `Paid at desk · ${amt}` };
}

/** Self-bookings only record money after the card charge has succeeded. */
export function spaBookingAmountPaid(price: number, method: string, paymentIntentId?: string): number {
  return method === "card" && paymentIntentId ? Math.round(price * 100) / 100 : 0;
}

/** A positive checkout balance must have a supported way to collect it. */
export function spaCheckoutPaymentError(method: string, balance: number, hasCard: boolean): string | null {
  if (balance <= 0 || method === "no_charge") return null;
  if (method === "card") return hasCard ? null : "No card on file. Select a different payment method.";
  if (["cash", "check", "other"].includes(method)) return null;
  return "Select a payment method to collect the balance due.";
}

/** Amount still to collect after what was already paid. Never negative. */
export function spaBalanceDue(newTotal: number, alreadyPaid: number): number {
  return Math.max(0, Math.round((newTotal - alreadyPaid) * 100) / 100);
}

/** Coverage offsets only the booked base service, never add-ons or tips. */
export function spaCoveredServiceAmount(appt: any): number {
  if (getSpaPaymentState(appt).kind !== "covered") return 0;
  return Math.max(0, Number(appt?.covered_checkout?.service_amount ?? appt?.member_price ?? appt?.service_price) || 0);
}

/** Retain coverage while recording actual extra money separately. */
export function spaCheckoutSettlement(appt: any, total: number, method: string, balance: number) {
  const state = getSpaPaymentState(appt);
  const collected = Math.round((state.paid + (method === "no_charge" ? 0 : balance)) * 100) / 100;
  if (state.kind === "covered") {
    return {
      amount_paid: collected,
      payment_method: appt.payment_method,
      covered_checkout: {
        service_amount: spaCoveredServiceAmount(appt),
        amount_paid: collected,
        payment_method: balance > 0 && method !== "no_charge" ? method : appt?.covered_checkout?.payment_method ?? null,
      },
    };
  }
  return {
    amount_paid: method === "no_charge" && state.paid === 0 ? 0 : Math.max(total, state.paid),
    payment_method: state.paid > 0 && balance === 0 ? (appt.payment_method || method) : method,
  };
}
