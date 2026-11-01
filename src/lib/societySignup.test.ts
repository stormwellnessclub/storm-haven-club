import { test } from "node:test";
import assert from "node:assert/strict";
import { canJoinSociety } from "./societySignup";

test("non-members cannot self-register for the next book club round", () => {
  assert.equal(canJoinSociety(null), false);
  assert.equal(canJoinSociety(undefined), false);
});
test("current members can join without treating a freeze as loss of membership", () => {
  for (const status of ["active", "frozen", "past_due"]) assert.equal(canJoinSociety({ status }), true);
});
test("cancelled, expired and pending memberships cannot self-register", () => {
  for (const status of ["cancelled", "expired", "pending", "pending_activation"]) assert.equal(canJoinSociety({ status }), false);
});