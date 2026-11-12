// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { cleanAnswers, firstMissing, isShown, needsDetail, reviewLabel, toggleMulti, CONSENT_SECTIONS } from "./aellaSculptForms";

const q = (id, extra = {}) => ({
  id, service_key: "aella-sculpt", section: "Health screening", title: null, prompt: id, answer_type: "yes_no", options: null,
  exclusive_option: null, detail_prompt: null, detail_on: [], review_on: [], hold_on: [], zone_ids: null, parent_id: null,
  show_when: null, is_required: true, sort_order: 0, is_active: true, ...extra,
});
const diabetes = q("diabetes");
const controlled = q("controlled", { answer_type: "yes_no_unsure", parent_id: "diabetes", show_when: ["yes"] });
const metal = q("metal", { detail_prompt: "Please describe the implant and location.", detail_on: ["yes"] });
const skin = q("skin", { answer_type: "multi", options: ["Open wound", "Active rash", "None of the above"], exclusive_option: "None of the above" });

describe("Aella Sculpt intake rules", () => {
  it("asks 'well controlled?' only when the client has diabetes", () => {
    expect(isShown(controlled, { diabetes: { answer: "no" } })).toBe(false);
    expect(isShown(controlled, { diabetes: { answer: "yes" } })).toBe(true);
  });
  it("needs the follow-up answer when shown", () => {
    expect(firstMissing([diabetes, controlled], { diabetes: { answer: "yes" } })?.id).toBe("controlled");
    expect(firstMissing([diabetes, controlled], { diabetes: { answer: "no" } })).toBe(null);
  });
  it("a Yes on metal/implants needs a description", () => {
    expect(needsDetail(metal, { metal: { answer: "yes" } })).toBe(true);
    expect(firstMissing([metal], { metal: { answer: "yes" } })?.id).toBe("metal");
    expect(firstMissing([metal], { metal: { answer: "yes", detail: "Hip replacement, left" } })).toBe(null);
  });
  it("'None of the above' clears other skin answers and the reverse", () => {
    expect(toggleMulti(skin, ["Open wound"], "None of the above")).toEqual(["None of the above"]);
    expect(toggleMulti(skin, ["None of the above"], "Active rash")).toEqual(["Active rash"]);
  });
  it("hidden follow-ups are not saved", () => {
    const out = cleanAnswers([diabetes, controlled], { diabetes: { answer: "no" }, controlled: { answer: "no" } });
    expect(out.controlled).toBeUndefined();
  });
  it("inactive questions are skipped", () => {
    expect(firstMissing([q("old", { is_active: false })], {})).toBe(null);
  });
});

describe("consent and review", () => {
  it("has the owner's eight consent sections", () => {
    expect(CONSENT_SECTIONS.map((s) => s.key)).toEqual(["nature", "not_weight_loss", "results", "responses", "communication", "health_info", "no_guarantee", "questions"]);
  });
  it("labels provider review states", () => {
    expect(reviewLabel("clear")).toBe("Clear");
    expect(reviewLabel("required")).toBe("Required");
    expect(reviewLabel("completed", "not_cleared")).toBe("Completed · Not cleared for treatment");
    expect(reviewLabel("completed", "cleared")).toBe("Completed · Cleared");
  });
});
