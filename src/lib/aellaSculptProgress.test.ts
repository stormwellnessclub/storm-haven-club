// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { changeSinceFirst, cleanMeasurements, defaultTreatmentNumber, SCULPT_MODALITIES, suggestedMeasurements } from "./aellaSculptProgress";

describe("Aella Sculpt progress tracking", () => {
  it("offers the six Aella Sculpt modalities", () => {
    expect([...SCULPT_MODALITIES]).toEqual(["Fat Cavitation", "Targeted Ultrasound Therapy", "Radiofrequency", "Lipo Laser", "Manual Sculpting", "Wood Therapy"]);
  });

  it("suggests spots that match each real treatment area", () => {
    expect(suggestedMeasurements("Back Thighs — Both")).toEqual(["Left upper thigh", "Right upper thigh"]);
    expect(suggestedMeasurements("Upper Back / Bra Line")).toEqual(["Bra line"]);
    expect(suggestedMeasurements("Flanks + Lower Back")).toEqual(["Waist at navel", "Top of hip bone"]);
  });

  it("never suggests body weight as a measurement", () => {
    for (const z of ["Abdomen + Waist", "Arms — Both", "Back Thighs — Both", "Flanks + Lower Back", "Front Thighs — Both", "Glutes", "Upper Back / Bra Line", null]) {
      expect(suggestedMeasurements(z).some((l) => /weight/i.test(l))).toBe(false);
    }
  });

  it("skips blank rows and named-but-unmeasured rows, keeps measured ones", () => {
    const r = cleanMeasurements([
      { label: "Waist at navel", value: "31.25", unit: "in" },
      { label: "Upper abdomen", value: "", unit: "in" },
      { label: "", value: "", unit: "in" },
    ]);
    expect(r).toEqual({ ok: true, measurements: [{ label: "Waist at navel", value: 31.25, unit: "in" }] });
  });

  it("rejects a value with no name and non-positive numbers", () => {
    expect(cleanMeasurements([{ label: "", value: "30", unit: "in" }]).ok).toBe(false);
    expect(cleanMeasurements([{ label: "Waist", value: "0", unit: "in" }]).ok).toBe(false);
    expect(cleanMeasurements([{ label: "Waist", value: "abc", unit: "cm" }]).ok).toBe(false);
  });

  it("compares to the first earlier record of the same spot and unit", () => {
    const history = [
      { recorded_on: "2026-11-20", measurements: [{ label: "Waist at navel", value: 32, unit: "in" }] },
      { recorded_on: "2026-11-27", measurements: [{ label: "Waist at navel", value: 31.5, unit: "in" }] },
    ];
    expect(changeSinceFirst(history, { label: "waist at navel", value: 31, unit: "in" }, "2026-12-04")).toBe(-1);
    expect(changeSinceFirst(history, { label: "Waist at navel", value: 80, unit: "cm" }, "2026-12-04")).toBe(null);
    expect(changeSinceFirst(history, { label: "Waist at navel", value: 32, unit: "in" }, "2026-11-20")).toBe(null);
  });

  it("numbers treatments by earlier non-cancelled visits", () => {
    const visits = [
      { id: "a", appointment_date: "2026-11-20", appointment_time: "10:00", status: "completed" },
      { id: "b", appointment_date: "2026-11-24", appointment_time: "10:00", status: "cancelled" },
      { id: "c", appointment_date: "2026-11-27", appointment_time: "10:00", status: "completed" },
      { id: "d", appointment_date: "2026-12-04", appointment_time: "10:00", status: "scheduled" },
    ];
    expect(defaultTreatmentNumber(visits, visits[3])).toBe(3);
    expect(defaultTreatmentNumber(visits, visits[0])).toBe(1);
  });
});
