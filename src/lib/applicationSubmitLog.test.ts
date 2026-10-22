// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { isDuplicateApplicationError } from "./applicationSubmitLog";

describe("isDuplicateApplicationError", () => {
  it("treats a unique-violation as an already-saved application", () => {
    expect(isDuplicateApplicationError({ code: "23505", message: "duplicate key" })).toBe(true);
  });
  it("does not hide other failures", () => {
    expect(isDuplicateApplicationError({ code: "42501", message: "row-level security" })).toBe(false);
  });
});
