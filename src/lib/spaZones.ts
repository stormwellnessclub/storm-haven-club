// Treatment zones for zone-based spa services (Aella Sculpt). Zones are rows in
// spa_treatment_zones, edited by managers; one zone per appointment.

export interface SpaTreatmentZone {
  id: string;
  service_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export const ZONE_PROMPT = "What area would you like to focus on?";
export const ZONE_PROMPT_NOTE =
  "Each Aella Sculpt appointment focuses intentionally on one treatment zone so adequate time can be dedicated to the full multi-modality treatment.";

/** Active zones for a service in staff-set order. */
export const activeZones = (all: SpaTreatmentZone[], serviceKey: string) =>
  all
    .filter((z) => z.service_key === serviceKey && z.is_active)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

/** Choosing a zone replaces any earlier choice: an appointment never holds two zones. */
export const chooseZone = (_current: string | null, next: string) => next;

/** Provider/date/time steps open only once a zone is chosen. */
export const canPickTimes = (zoneId: string | null) => !!zoneId;

/** Service name as staff see it on schedules, with the booked zone when there is one. */
export const spaServiceLabel = (apt: { service_name?: string | null; treatment_zone_name?: string | null }) =>
  apt.treatment_zone_name ? `${apt.service_name ?? ""} · ${apt.treatment_zone_name}` : apt.service_name ?? "";

/** Move a zone up or down; returns the new order as [id, display_order] pairs. */
export function reorderZones(zones: SpaTreatmentZone[], id: string, dir: -1 | 1): [string, number][] {
  const list = [...zones].sort((a, b) => a.display_order - b.display_order);
  const i = list.findIndex((z) => z.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [];
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((z, k) => [z.id, k] as [string, number]).filter(([zid, k]) => zones.find((z) => z.id === zid)!.display_order !== k);
}
