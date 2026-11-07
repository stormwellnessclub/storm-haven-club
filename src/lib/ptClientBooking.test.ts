import { describe, expect, it } from "bun:test";
import { resolveClientBookingMode } from "./ptClientBooking";

describe("resolveClientBookingMode", () => {
  it("global off wins over any trainer override", () => {
    expect(resolveClientBookingMode({ global: "off", override: "request", instantReady: true })).toBe("off");
    expect(resolveClientBookingMode({ global: "off", override: "instant", instantReady: true })).toBe("off");
  });

  it("follow uses the club setting", () => {
    expect(resolveClientBookingMode({ global: "request", override: "follow", instantReady: false })).toBe("request");
  });

  it("hidden trainer is never bookable", () => {
    expect(resolveClientBookingMode({ global: "request", override: "hidden", instantReady: true })).toBe("off");
  });

  it("one trainer can take requests before the club default does", () => {
    expect(resolveClientBookingMode({ global: "request", override: "request", isPtTrainer: false, instantReady: false })).toBe("request");
    expect(resolveClientBookingMode({ global: "request", override: "follow", isPtTrainer: false, instantReady: false })).toBe("off");
  });

  it("instant booking stays disabled until availability is ready", () => {
    expect(resolveClientBookingMode({ global: "instant", override: "follow", instantReady: false })).toBe("off");
    expect(resolveClientBookingMode({ global: "request", override: "instant", instantReady: false })).toBe("off");
    expect(resolveClientBookingMode({ global: "instant", override: "follow", instantReady: true })).toBe("instant");
  });
});
