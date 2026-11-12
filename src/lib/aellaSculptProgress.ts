/** Aella Sculpt progress tracking rules (provider-only records). No weight: Aella Sculpt is not a weight-loss treatment. */

export const SCULPT_MODALITIES = [
  "Fat Cavitation",
  "Targeted Ultrasound Therapy",
  "Radiofrequency",
  "Lipo Laser",
  "Manual Sculpting",
  "Wood Therapy",
] as const;

export const PHOTO_VIEWS = ["Front", "Left side", "Right side", "Back"] as const;

export type MeasureUnit = "in" | "cm";
export interface Measurement { label: string; value: number; unit: MeasureUnit }
export interface MeasurementDraft { label: string; value: string; unit: MeasureUnit }

/** Starting measurement names for a treatment area; providers can rename, add or remove them. */
export function suggestedMeasurements(zoneName: string | null | undefined): string[] {
  const z = (zoneName ?? "").toLowerCase();
  if (z.includes("abdomen") || z.includes("waist")) return ["Upper abdomen", "Waist at navel", "Lower abdomen"];
  if (z.includes("thigh")) return ["Left upper thigh", "Right upper thigh"];
  if (z.includes("bra") || z.includes("upper back")) return ["Bra line"];
  if (z.includes("flank") || z.includes("lower back")) return ["Waist at navel", "Top of hip bone"];
  if (z.includes("arm")) return ["Left upper arm", "Right upper arm"];
  if (z.includes("glute") || z.includes("hip")) return ["Hips at widest point"];
  return ["Measurement 1"];
}

/** Turn the provider's typed rows into saved measurements. Blank rows are skipped; half-filled rows are errors. */
export function cleanMeasurements(rows: MeasurementDraft[]): { ok: true; measurements: Measurement[] } | { ok: false; error: string } {
  const out: Measurement[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    const raw = r.value.trim();
    if (!label && !raw) continue;
    if (!label) return { ok: false, error: "Each measurement needs a name." };
    if (label.length > 60) return { ok: false, error: `"${label.slice(0, 20)}…" is too long a name.` };
    if (!raw) continue; // named but not measured this visit
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value >= 1000) return { ok: false, error: `Enter a number above 0 for ${label}.` };
    out.push({ label, value: Math.round(value * 100) / 100, unit: r.unit });
  }
  if (out.length > 20) return { ok: false, error: "Up to 20 measurements per visit." };
  return { ok: true, measurements: out };
}

export interface ProgressPoint { recorded_on: string; measurements: Measurement[] }

/** Change since the first record that measured the same spot in the same unit (oldest record = baseline). */
export function changeSinceFirst(history: ProgressPoint[], current: Measurement, currentDate: string): number | null {
  const earlier = [...history]
    .filter((h) => h.recorded_on < currentDate)
    .sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const key = current.label.trim().toLowerCase();
  for (const h of earlier) {
    const m = h.measurements.find((x) => x.label.trim().toLowerCase() === key && x.unit === current.unit);
    if (m) return Math.round((current.value - m.value) * 100) / 100;
  }
  return null;
}

export interface VisitLite { id: string; appointment_date: string; appointment_time?: string | null; status: string }

/** Default treatment number: this client's earlier Aella Sculpt visits that were not cancelled, plus one. */
export function defaultTreatmentNumber(visits: VisitLite[], current: VisitLite): number {
  const key = (v: VisitLite) => `${v.appointment_date} ${v.appointment_time ?? ""}`;
  const earlier = visits.filter((v) => v.id !== current.id && v.status !== "cancelled" && key(v) < key(current));
  return earlier.length + 1;
}

export const formatChange = (n: number, unit: MeasureUnit) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)} ${unit}`;
