import { describe, expect, it } from "bun:test";
import { readFunctionError } from "./functionError";

describe("readFunctionError", () => {
  it("returns the function's real reason from a refused reply", async () => {
    const err = { context: new Response(JSON.stringify({ error: "That time was just booked. Please choose another time." }), { status: 409 }) };
    expect((await readFunctionError(err))?.error).toBe("That time was just booked. Please choose another time.");
  });
  it("returns null for network failures", async () => {
    expect(await readFunctionError(new Error("Failed to fetch"))).toBeNull();
  });
});
