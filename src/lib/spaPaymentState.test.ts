// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { getSpaPaymentState, spaBalanceDue } from "./spaPaymentState";

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
});
