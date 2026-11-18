// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { saleHasEnded, formatUsd } from "./blackFriday";

const end = "2026-12-01T04:59:59.000Z"; // Nov 30, 11:59:59 PM Detroit
describe("Black Friday sale window", () => {
  it("is open at 11:58 PM Nov 30 Detroit", () => expect(saleHasEnded(end, new Date("2026-12-01T04:58:00Z"))).toBe(false));
  it("has ended after midnight Dec 1 Detroit", () => expect(saleHasEnded(end, new Date("2026-12-01T05:00:01Z"))).toBe(true));
  it("formats prices", () => expect(formatUsd(188000)).toBe("$1,880"));
});
