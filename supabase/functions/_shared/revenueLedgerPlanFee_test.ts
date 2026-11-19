import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPlanProcessingFee } from "./revenueLedgerSync.ts";

Deno.test("a $520 plan payment's $15.84 processing fee is recognised as a fee", () => {
  assert(isPlanProcessingFee(52000, 1584));
});
Deno.test("an older $514.28 plan invoice's $15.67 fee line is recognised as a fee", () => {
  assert(isPlanProcessingFee(51428, 1567));
});
Deno.test("a second training line is not mistaken for a fee", () => {
  assertFalse(isPlanProcessingFee(52000, 52000));
  assertFalse(isPlanProcessingFee(52000, 1000));
});
