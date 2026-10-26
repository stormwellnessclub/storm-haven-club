// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { classPassSuccessUrl, checkoutSessionFromSearch, reconcileClassPayment } from "./classPassCheckout";

describe("class pass checkout return", () => {
  it("preserves the chosen class return flag with a valid checkout parameter", () => {
    const result = classPassSuccessUrl("https://stormwellnessclub.com/schedule?resumeBooking=1&purchase=success");
    expect(result).toBe("https://stormwellnessclub.com/schedule?resumeBooking=1&purchase=success&session_id={CHECKOUT_SESSION_ID}");
  });
  it("reads both clean and previously malformed checkout returns", () => {
    expect(checkoutSessionFromSearch("?resumeBooking=1&purchase=success?session_id=cs_test")).toBe("cs_test");
    expect(checkoutSessionFromSearch("?session_id=cs_test")).toBe("cs_test");
  });
  it("selects a purchased pass instead of unavailable membership credits", () => {
    expect(reconcileClassPayment({ paymentMethod: "credits", selectedPassId: null, selectedPassType: null }, false, [{ id: "purchased", pass_type: "single" }])).toEqual({ paymentMethod: "pass", selectedPassId: "purchased", selectedPassType: "single" });
  });
  it("preserves a still-valid pass choice when balances refresh", () => {
    expect(reconcileClassPayment({ paymentMethod: "pass", selectedPassId: "chosen", selectedPassType: "single" }, true, [{ id: "new", pass_type: "10_pack" }, { id: "chosen", pass_type: "single" }]).selectedPassId).toBe("chosen");
  });
});