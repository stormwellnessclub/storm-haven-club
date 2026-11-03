// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { buildPayroll, splitOvertime } from "./payroll";

const shift = (inAt: string, hours: number, extra = {}) => ({
  person_key: "user:a", person_name: "Ana", source: "shift",
  detail: { clock_in_at: inAt, clock_out_at: new Date(new Date(inAt).getTime() + hours * 3_600_000).toISOString(), department: "cafe", hourly_rate: 20, ...extra },
});

describe("payroll", () => {
  it("pays hours over 40 in one week at time and a half", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map((d) => shift(`${d}T14:00:00Z`, 9));
    const [l] = buildPayroll(days, []);
    expect(l.regularHours).toBe(40);
    expect(l.overtimeHours).toBe(5);
    expect(l.grossPay).toBe(40 * 20 + 5 * 30);
  });
  it("does not combine two weeks into overtime", () => {
    const r = splitOvertime([shift("2026-11-06T14:00:00Z", 30).detail, shift("2026-11-09T14:00:00Z", 30).detail]);
    expect(r).toEqual({ regular: 60, overtime: 0 });
  });
  it("pays nothing for a shift that was never clocked out and flags it", () => {
    const [l] = buildPayroll([{ ...shift("2026-11-02T14:00:00Z", 1), detail: { clock_in_at: "2026-11-02T14:00:00Z", clock_out_at: null, department: "cafe", hourly_rate: 20 } }], []);
    expect(l.grossPay).toBe(0);
    expect(l.openShifts).toBe(1);
  });
  it("keeps spa tips out of gross pay and applies commission", () => {
    const rows = [{ person_key: "therapist:t", person_name: "Teresa", source: "spa", detail: { price: 150, tip: 30 } }];
    const [l] = buildPayroll(rows, [{ person_key: "therapist:t", spa_commission_pct: 40 }]);
    expect(l.spaCommission).toBe(60);
    expect(l.tips).toBe(30);
    expect(l.grossPay).toBe(60);
  });
  it("flags people with work but no pay rate", () => {
    const [l] = buildPayroll([{ person_key: "instructor:i", person_name: "Kim", source: "pt", detail: {} }], []);
    expect(l.missingRate).toBe(true);
  });
});
