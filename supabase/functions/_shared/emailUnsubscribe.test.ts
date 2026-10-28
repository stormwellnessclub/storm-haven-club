// @ts-nocheck
import { it, expect, mock } from "bun:test";
import { recordEmailPreference } from "./emailUnsubscribe";

it("records an unsubscribe for someone with no existing marketing contact", async () => {
  const insert = mock(async () => ({ error: null }));
  const query = { select: () => query, ilike: async () => ({ data: [], error: null }), insert };
  await recordEmailPreference({ from: () => query }, " PERSON@example.invalid ", false);
  expect(insert.mock.calls[0][0].email).toBe("person@example.invalid");
  expect(insert.mock.calls[0][0].opted_in_email).toBe(false);
  expect(insert.mock.calls[0][0].unsubscribed_at).toEqual(expect.any(String));
});
it("does not claim an unsubscribe succeeded if saving fails", async () => {
  const query = { select: () => query, ilike: async () => ({ data: [], error: null }), insert: async () => ({ error: { message: "offline" } }) };
  await expect(recordEmailPreference({ from: () => query }, "person@example.invalid", false)).rejects.toThrow("Could not save email preference");
});