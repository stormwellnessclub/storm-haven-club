// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { ptRequestProblem } from "./ptRequestForm";

const base = { date: "2026-11-20", time: "10:00", flexibility: "window" as const, earliest: "10:00", latest: "13:00" };

describe("ptRequestProblem", () => {
  it("accepts a time inside the window", () => expect(ptRequestProblem(base, "2026-11-15")).toBeNull());
  it("rejects a window that ends before it starts", () =>
    expect(ptRequestProblem({ ...base, earliest: "13:00", latest: "10:00" }, "2026-11-15")).toBe("Your window must end after it starts."));
  it("rejects a preferred time outside the window", () =>
    expect(ptRequestProblem({ ...base, time: "14:00" }, "2026-11-15")).toBe("Your preferred time must fall inside your window."));
  it("rejects a past date", () => expect(ptRequestProblem(base, "2026-11-21")).toBe("Choose a date from today onward."));
  it("exact time needs no window", () =>
    expect(ptRequestProblem({ ...base, flexibility: "exact", earliest: "", latest: "" }, "2026-11-15")).toBeNull());
});
