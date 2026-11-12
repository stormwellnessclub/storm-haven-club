import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canCharge, chargeLabel, processingFeeCents } from "./policy.ts";

Deno.test("$80 late cancellation adds the club processing fee", () => {
  // (8000 + 30) / 0.971 = 8269.82 -> 8270 total
  assertEquals(processingFeeCents(8000), 270);
});

Deno.test("clients can only charge their own late cancellation; staff can charge any", () => {
  assertEquals(canCharge({ user_id: "u1", kind: "late_cancel" }, "u1", false), true);
  assertEquals(canCharge({ user_id: "u1", kind: "late_cancel" }, "u2", false), false);
  assertEquals(canCharge({ user_id: "u1", kind: "no_show" }, "u1", false), false);
  assertEquals(canCharge({ user_id: "u1", kind: "no_show" }, "staff", true), true);
});

Deno.test("charge says what it was for", () => {
  assertEquals(chargeLabel("late_cancel", "Aella Sculpt", "Mon, Nov 16 at 10:00 AM"), "Spa Aella: Aella Sculpt late cancellation — Mon, Nov 16 at 10:00 AM");
  assertEquals(chargeLabel("no_show", "Aella Sculpt", "Mon, Nov 16 at 10:00 AM"), "Spa Aella: Aella Sculpt missed appointment — Mon, Nov 16 at 10:00 AM");
});
