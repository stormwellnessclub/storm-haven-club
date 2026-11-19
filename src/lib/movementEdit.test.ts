// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { processingFeeCents } from "./movementEdit";
describe("Movement Edit checkout fee", () => {
  it("$75 Discovery Pass adds a $2.55 processing fee", () => expect(processingFeeCents(7500)).toBe(255));
  it("$255 Movement Edit adds a $7.92 processing fee", () => expect(processingFeeCents(25500)).toBe(792));
  it("$285 Club Experience adds an $8.82 processing fee", () => expect(processingFeeCents(28500)).toBe(882));
});
describe("Member Movement Edit", () => {
  it("$160 package adds a $5.09 processing fee", () => expect(processingFeeCents(16000)).toBe(509));
});
