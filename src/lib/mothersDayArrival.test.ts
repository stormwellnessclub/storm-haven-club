// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { isMothersDayVoucher } from "./mothersDayArrival";

describe("isMothersDayVoucher", () => {
  test("voucher appointments get the arrival note", () => {
    expect(isMothersDayVoucher({ payment_method: "mothers_day_voucher" })).toBe(true);
  });
  test("card or credit appointments do not", () => {
    expect(isMothersDayVoucher({ payment_method: "card" })).toBe(false);
    expect(isMothersDayVoucher({ payment_method: null })).toBe(false);
    expect(isMothersDayVoucher(null)).toBe(false);
  });
});
