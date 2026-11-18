import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { promoBlockReason, processingFeeCents, chargeDescription } from "./rules.ts";

const end = new Date("2026-12-01T04:59:59Z").toISOString(); // Nov 30 11:59:59 PM Detroit
const pack = (aud: string) => ({ price_cents: 104000, sessions: 20, promo_audience: aud, sale_starts_at: null, sale_ends_at: end, is_active: true });

Deno.test("member can buy member price before Nov 30 11:59 PM", () => {
  assertEquals(promoBlockReason(pack("member"), true, new Date("2026-12-01T04:59:00Z")), null);
});
Deno.test("sale stops after Nov 30 11:59 PM Detroit", () => {
  assertEquals(promoBlockReason(pack("member"), true, new Date("2026-12-01T05:00:30Z")), "This offer has ended.");
});
Deno.test("non-member cannot buy member price", () => {
  assertEquals(promoBlockReason(pack("member"), false, new Date("2026-11-20T12:00:00Z")) !== null, true);
});
Deno.test("member cannot buy non-member price", () => {
  assertEquals(promoBlockReason(pack("non_member"), true, new Date("2026-11-20T12:00:00Z")) !== null, true);
});
Deno.test("processing fee uses (amount + $0.30) / (1 - 0.029)", () => {
  assertEquals(52000 + processingFeeCents(52000), Math.ceil(52030 / 0.971));
});
Deno.test("Stripe label names the package", () => {
  assertEquals(chargeDescription(20, true), "Black Friday Semi-Private PT – 20 Sessions (Member)");
});
