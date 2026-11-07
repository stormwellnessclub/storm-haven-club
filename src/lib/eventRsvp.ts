// Single source for where an event reply puts an event in the member portal and which button it gets.
export type RsvpResponse = "yes" | "maybe" | "no" | "dismissed" | null;
export type PortalBucket = "upcoming" | "considering" | "invitation" | "past" | "hidden";

export function portalBucket(response: RsvpResponse, startsAt: string, now: Date = new Date()): PortalBucket {
  const past = new Date(startsAt).getTime() <= now.getTime();
  if (past) return response === "yes" ? "past" : "hidden";
  if (response === "yes") return "upcoming";
  if (response === "maybe") return "considering";
  if (response === "no" || response === "dismissed") return "hidden";
  return "invitation";
}

export type ActionLabel =
  | "RSVP" | "View RSVP" | "Update response" | "Join waitlist" | "View membership access"
  | "Sign in to RSVP" | "Reserve" | "View recap" | "View event";

export function eventActionLabel(o: {
  signedIn: boolean; eligible: boolean; response: RsvpResponse; past: boolean;
  atCapacity?: boolean; publicTicketed?: boolean; hasRecap?: boolean;
}): ActionLabel {
  if (o.past) return o.hasRecap ? "View recap" : "View event";
  if (o.publicTicketed) return "Reserve";
  if (!o.signedIn) return "Sign in to RSVP";
  if (!o.eligible) return "View membership access";
  if (o.response === "yes") return "View RSVP";
  if (o.response === "maybe") return "Update response";
  if (o.atCapacity) return "Join waitlist";
  return "RSVP";
}

/** Round state decides page order; dates promote a finished gathering to the archive. */
export type RoundState =
  | "draft" | "nominations_open" | "voting_open" | "selection_pending" | "book_selected"
  | "rsvp_open" | "gathering_upcoming" | "gathering_completed" | "archived";

export function effectiveRoundState(state: string | null, endsAt: string, now: Date = new Date()): RoundState {
  if (new Date(endsAt).getTime() <= now.getTime()) return state === "archived" ? "archived" : "gathering_completed";
  return (state as RoundState) || "draft";
}

export function arrangeRounds<T extends { round_state: string | null; ends_at: string | null; starts_at: string }>(
  rounds: T[], now: Date = new Date(),
) {
  const sorted = [...rounds].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const isDone = (r: T) => ["gathering_completed", "archived"].includes(effectiveRoundState(r.round_state, r.ends_at ?? r.starts_at, now));
  const live = sorted.filter((r) => !isDone(r) && r.round_state !== "draft");
  return { current: live[0] ?? null, next: live[1] ?? null, past: sorted.filter(isDone).reverse() };
}
