import { it, expect } from "bun:test";
import { isUnsubscribeReply } from "./unsubscribeReply";

it("treats a plain 'Unsubscribe' reply as an unsubscribe", () => {
  expect(isUnsubscribeReply("Re: The Seasonal Edit", "Unsubscribe\n\nOn Sat, Nov 21, 2026 Storm Wellness Club wrote:\n> The Seasonal Edit is here")).toBe(true);
});
it("treats 'please remove me from your list' as an unsubscribe", () => {
  expect(isUnsubscribeReply("Re: offer", "Please remove me from your list.")).toBe(true);
});
it("treats 'STOP' as an unsubscribe", () => {
  expect(isUnsubscribeReply("Re: offer", "STOP")).toBe(true);
});
it("treats an empty reply with subject 'Unsubscribe' as an unsubscribe", () => {
  expect(isUnsubscribeReply("Unsubscribe", "")).toBe(true);
});
it("keeps a real question in the inbox even if it mentions unsubscribing", () => {
  expect(isUnsubscribeReply("Re: offer", "How do I unsubscribe from texts but keep emails? Also is the Discovery Pass still available?")).toBe(false);
});
it("keeps a normal reply in the inbox", () => {
  expect(isUnsubscribeReply("Re: The Seasonal Edit", "Can I buy the 30 session plan for my husband?")).toBe(false);
});
