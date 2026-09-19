export const CLUB_TZ = "America/Detroit";

export type EventEligibility =
  | "public"
  | "all_members"
  | "founding_only"
  | "diamond_only"
  | "diamond_founding"
  | "selected_tiers"
  | "invitation_only";

/** Member-facing wording. Never exposes the internal tier ranking. */
export function eligibilityLabel(
  eligibility?: string | null,
  tiers?: string[] | null,
): string {
  switch (eligibility) {
    case "all_members":
      return "Members only";
    case "founding_only":
      return "Founding Members";
    case "diamond_only":
      return "Diamond Members";
    case "diamond_founding":
      return "Diamond & Founding Members";
    case "selected_tiers":
      return tiers && tiers.length ? `${tiers.join(" & ")} Members` : "Select memberships";
    case "invitation_only":
      return "By invitation";
    default:
      return "Open to all";
  }
}

export function isMembersOnlyEvent(e: {
  members_only?: boolean | null;
  eligibility?: string | null;
}): boolean {
  return !!e.members_only || (!!e.eligibility && e.eligibility !== "public");
}

/** Wording for how a member pays — never the word "free". */
export function priceLabel(e: {
  is_included?: boolean | null;
  member_price_cents?: number | null;
}): string {
  if (e.is_included || !e.member_price_cents) return "Included with membership";
  return `$${(e.member_price_cents / 100).toFixed(0)} per member`;
}

/** Builds a Google Calendar link for an event. */
export function addToCalendarUrl(e: {
  title: string;
  starts_at: string;
  duration_minutes?: number | null;
  venue?: string | null;
  description?: string | null;
}): string {
  const start = new Date(e.starts_at);
  const end = new Date(start.getTime() + (e.duration_minutes ?? 90) * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: e.venue || "Storm Wellness Club, Livonia, MI",
    details: (e.description || "").slice(0, 900),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
