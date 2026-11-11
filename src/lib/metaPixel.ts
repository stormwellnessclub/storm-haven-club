// Meta Pixel events for ad optimization. The base pixel and PageView live in index.html;
// the pixel also counts in-app route changes on its own, so pages never send PageView.
export type MetaStandardEvent = "Lead" | "Purchase" | "Schedule";

type Fbq = (...args: unknown[]) => void;

/**
 * Sends one standard Meta event. Never throws and never blocks: tracking must not break
 * a payment or a form. Keep personal data (names, emails, phones) out of params and eventId.
 */
export function trackMetaEvent(
  event: MetaStandardEvent,
  params: Record<string, string | number> = {},
  eventId?: string,
): void {
  try {
    const fbq = (globalThis as { fbq?: Fbq }).fbq;
    if (typeof fbq !== "function") return;
    if (eventId) fbq("track", event, params, { eventID: eventId });
    else fbq("track", event, params);
  } catch {
    // An ad blocker or a pixel error must never surface to the visitor.
  }
}
