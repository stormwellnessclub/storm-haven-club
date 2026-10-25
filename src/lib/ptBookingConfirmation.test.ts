// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { notifyPTBooking } from "./ptBookingConfirmation";

describe("automatic staff PT confirmation", () => {
  it("requests confirmation for the newly booked appointment", async () => {
    const calls = [];
    expect(await notifyPTBooking("new-appointment", async (...args) => { calls.push(args); return { data: { success: true }, error: null }; })).toBeNull();
    expect(calls).toEqual([["send-pt-booking-email", { body: { appointment_id: "new-appointment", type: "confirmation" } }]]);
  });
  it("surfaces HTTP-200 notification failures without throwing or rebooking", async () => {
    expect(await notifyPTBooking("appt", async () => ({ data: { success: false }, error: null }))).not.toBeNull();
  });
  it("does not treat SMS consent skips as delivery failures", async () => {
    expect(await notifyPTBooking("appt", async () => ({ data: { success: true, sms_skipped: true }, error: null }))).toBeNull();
  });
  it("warns about text failures and safely catches network failures", async () => {
    expect(await notifyPTBooking("appt", async () => ({ data: { success: true, sms_warning: true }, error: null }))).not.toBeNull();
    expect(await notifyPTBooking("appt", async () => { throw new Error("offline"); })).not.toBeNull();
  });
});