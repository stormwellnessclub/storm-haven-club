// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { confirmationSms } from "./confirmationSms";

describe("PT booking confirmation texts", () => {
  const appt = { id: "appt-1", user_id: "client-1", format: "one_on_one", starts_at: "2026-10-26T15:30:00Z", duration_minutes: 60 };
  it("targets the booked client through consent-checked send-sms", () => {
    const body = confirmationSms(appt, "Klaudia");
    expect(body.to).toEqual({ userId: "client-1" });
    expect(body.templateKey).toBe("appointment-confirmation");
    expect(body).not.toHaveProperty("bypassConsent");
  });
  it("includes session format, duration, trainer and Detroit appointment time", () => {
    expect(confirmationSms(appt, "Klaudia").variables).toEqual({ service: "1:1 Personal Training (60 min)", date: "Mon, Oct 26", time: "11:30 AM", provider: "Klaudia" });
  });
  it("deduplicates repeat confirmations for the same appointment", () => {
    expect(confirmationSms(appt, "Klaudia").idempotencyKey).toBe("pt-confirmation-appt-1");
    expect(confirmationSms({ ...appt, id: "appt-2" }, "Klaudia").idempotencyKey).toBe("pt-confirmation-appt-2");
  });
});