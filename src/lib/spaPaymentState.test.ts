// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { getSpaPaymentState, spaBalanceDue, spaBookingAmountPaid, spaCheckoutPaymentError } from "./spaPaymentState";

describe("spa payment state", () => {
  it("online prepaid booking shows Prepaid", () => {
    const s = getSpaPaymentState({ amount_paid: 195, payment_method: "card", payment_intent_id: "pi_1", status: "confirmed" });
    expect(s.kind).toBe("prepaid_online");
    expect(s.paid).toBe(195);
  });
  it("card on file with nothing charged is Not paid", () => {
    expect(getSpaPaymentState({ amount_paid: null, payment_method: "card", status: "confirmed" }).kind).toBe("unpaid");
  });
  it("only the add-ons and tip are due after prepayment", () => {
    expect(spaBalanceDue(195 + 25 + 30, 195)).toBe(55);
  });
  it("lowering the price never creates a negative charge", () => {
    expect(spaBalanceDue(150, 195)).toBe(0);
  });
  it("legacy member-account bookings still owe the full $195", () => {
    const s = getSpaPaymentState({ amount_paid: 195, payment_method: "member_account", payment_intent_id: null, status: "confirmed" });
    expect(s.kind).toBe("unpaid");
    expect(s.paid).toBe(0);
    expect(spaBalanceDue(195, s.paid)).toBe(195);
  });
  it("legacy uncharged card bookings still owe the full $195", () => {
    const s = getSpaPaymentState({ amount_paid: 195, payment_method: "card", payment_intent_id: null, status: "confirmed" });
    expect(s.kind).toBe("unpaid");
    expect(spaBalanceDue(195, s.paid)).toBe(195);
  });
  it("completed appointments without a card charge are still unpaid", () => {
    expect(getSpaPaymentState({ amount_paid: 195, payment_method: "member_account", status: "completed" }).paid).toBe(0);
  });
  for (const method of ["cash", "check", "other"]) {
    it(`preserves the $195 actually recorded as ${method}`, () => {
      const s = getSpaPaymentState({ amount_paid: 195, payment_method: method, status: "completed" });
      expect(s.kind).toBe("paid_desk");
      expect(spaBalanceDue(195, s.paid)).toBe(0);
    });
  }
  it("records zero collected for a member-account self-booking", () => {
    expect(spaBookingAmountPaid(195, "member_account")).toBe(0);
  });
  it("records zero collected for an uncharged card self-booking", () => {
    expect(spaBookingAmountPaid(195, "card")).toBe(0);
  });
  it("records $195 only after a card payment reference is returned", () => {
    expect(spaBookingAmountPaid(195, "card", "pi_success")).toBe(195);
  });
  it("Mother's Day voucher appointment shows as covered, not unpaid", () => {
    const s = getSpaPaymentState({ amount_paid: 0, payment_method: "mothers_day_voucher", status: "confirmed" });
    expect(s.kind).toBe("covered");
    expect(s.paid).toBe(0);
  });
  it("credit appointment shows as covered", () => {
    expect(getSpaPaymentState({ amount_paid: 0, payment_method: "credit", status: "confirmed" }).kind).toBe("covered");
  });
  it("does not record voucher coverage as money collected", () => {
    expect(spaBookingAmountPaid(195, "mothers_day_voucher")).toBe(0);
  });
  it("cannot settle $195 by skipping the charge without a card", () => {
    expect(spaCheckoutPaymentError("card", 195, false)).not.toBeNull();
  });
  it("cannot settle $195 using the uncollected member-account method", () => {
    expect(spaCheckoutPaymentError("member_account", 195, true)).not.toBeNull();
  });
  it("allows collecting $195 by a saved card or recorded cash", () => {
    expect(spaCheckoutPaymentError("card", 195, true)).toBeNull();
    expect(spaCheckoutPaymentError("cash", 195, false)).toBeNull();
  });
  it("needs no card to complete an already-paid appointment", () => {
    expect(spaCheckoutPaymentError("card", 0, false)).toBeNull();
  });
});
