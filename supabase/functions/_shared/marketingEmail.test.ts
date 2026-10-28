// @ts-nocheck
import { describe, it, expect, mock } from "bun:test";
import { sendMarketingEmail, isSuppressed, verifyUnsubToken } from "./marketingEmail";

// Isolated environment and transport: no client emails or live data are touched.
globalThis.Deno = { env: { get: (key) => ({ EMAIL_UNSUBSCRIBE_SECRET: "isolated-test-secret", SUPABASE_URL: "https://example.invalid" })[key] } };
function database(suppressed = false, failure = false) {
  return { from: (table) => {
    const query = { select: () => query, ilike: () => query, or: () => query,
      limit: async () => ({ data: table === "marketing_contacts" && suppressed ? [{ id: "test" }] : [], error: failure ? { message: "offline" } : null }) };
    return query;
  } };
}
describe("marketing unsubscribe enforcement", () => {
  it("does not send marketing to an unsubscribed address", async () => {
    const send = mock(async () => ({ data: { id: "test" } }));
    const result = await sendMarketingEmail(database(true), { emails: { send } }, { to: ["person@example.invalid"], html: "<p>Invitation</p>" });
    expect(result.skipped).toBe(true);
    expect(send).toHaveBeenCalledTimes(0);
  });
  it("routes unsubscribe headers to the system and uses a matching signed link", async () => {
    const send = mock(async (payload) => ({ data: payload }));
    const result = await sendMarketingEmail(database(), { emails: { send } }, { to: [" PERSON@example.invalid "], html: "<p>Invitation</p>", headers: { "List-Unsubscribe": "<mailto:admin@example.invalid>" } });
    const url = new URL(result.data.headers["List-Unsubscribe"].slice(1, -1));
    expect(url.pathname).toBe("/functions/v1/email-unsubscribe");
    expect(url.searchParams.get("e")).toBe("person@example.invalid");
    expect(await verifyUnsubToken(url.searchParams.get("e"), url.searchParams.get("t"))).toBe(true);
    expect(result.data.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
  it("never sends when consent lookup fails", async () => {
    const send = mock(async () => ({}));
    await expect(sendMarketingEmail(database(false, true), { emails: { send } }, { to: "person@example.invalid", html: "Invitation" })).rejects.toThrow("Could not verify marketing email consent");
    expect(send).toHaveBeenCalledTimes(0);
  });
  it("rejects a token issued for another address", async () => {
    expect(await verifyUnsubToken("other@example.invalid", "invalid-token")).toBe(false);
  });
});