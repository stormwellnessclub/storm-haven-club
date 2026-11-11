// One arrival note per spa service type, used by confirmation and reminder emails.
export const BODY_WRAP_ARRIVAL_NOTE =
  "Please arrive 20–30 minutes early so there's time for your red light and vibration plate session before your wrap.";
export const STANDARD_SPA_ARRIVAL_NOTE = "Please arrive 10 minutes early to settle in.";

export function spaArrivalNote(intakeKind?: string | null): string {
  return intakeKind === "body_wrap" ? BODY_WRAP_ARRIVAL_NOTE : STANDARD_SPA_ARRIVAL_NOTE;
}
