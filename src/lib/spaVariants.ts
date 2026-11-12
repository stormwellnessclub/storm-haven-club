/**
 * Groups the separate length versions of one treatment (e.g. "Deep Relief Massage — 60" and "— 90",
 * or "Detox Seaweed & Charcoal Wrap" and its "(Extended)" version) into a single menu listing,
 * so every length stays visible and bookable instead of only the shortest one.
 */
interface Variant {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  is_active: boolean;
}

export const treatmentBaseName = (name: string) =>
  name
    .replace(/\s*\(extended\)\s*$/i, "")
    .replace(/\s*[—–-]\s*\d+\s*(min(utes)?)?\s*$/i, "")
    .trim();

export interface TreatmentGroup<T> {
  key: string;
  name: string;
  variants: T[];
}

/** Keeps the incoming order (first appearance) and sorts each treatment's lengths shortest first. */
export function groupTreatments<T extends Variant>(services: T[]): TreatmentGroup<T>[] {
  const groups = new Map<string, TreatmentGroup<T>>();
  for (const s of services) {
    if (!s.is_active) continue;
    const name = treatmentBaseName(s.name);
    const key = `${s.category}::${name.toLowerCase()}`;
    const g = groups.get(key) ?? { key, name, variants: [] };
    g.variants.push(s);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, variants: [...g.variants].sort((a, b) => a.duration_minutes - b.duration_minutes) }));
}
