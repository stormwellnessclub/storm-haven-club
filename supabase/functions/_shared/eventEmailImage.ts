// One rule for which photo an event email uses. Shared by the app editor and email senders.
// Order: event email photo -> event hero photo -> approved series photo -> logo-only (no photo).
export type ImageSource = "event_email" | "event_hero" | "collection" | "logo_only";

export function resolveEventEmailImage(
  event: { email_image_url?: string | null; image_url?: string | null; image_alt?: string | null; title?: string | null } | null,
  collection?: { email_image_url?: string | null; image_url?: string | null; name?: string | null } | null,
): { url: string | null; alt: string; source: ImageSource } {
  const alt = event?.image_alt || event?.title || collection?.name || "Storm Wellness Club";
  const ok = (u?: string | null) => !!u && /^https:\/\//i.test(u);
  if (ok(event?.email_image_url)) return { url: event!.email_image_url!, alt, source: "event_email" };
  if (ok(event?.image_url)) return { url: event!.image_url!, alt, source: "event_hero" };
  if (ok(collection?.email_image_url)) return { url: collection!.email_image_url!, alt, source: "collection" };
  if (ok(collection?.image_url)) return { url: collection!.image_url!, alt, source: "collection" };
  return { url: null, alt, source: "logo_only" };
}

export const IMAGE_SOURCE_LABEL: Record<ImageSource, string> = {
  event_email: "This event's email photo",
  event_hero: "This event's main photo",
  collection: "The series photo (fallback)",
  logo_only: "No photo — logo-only layout",
};
