export type ImageRecord = {
  image_url?: string | null;
  image_urls?: string[] | null;
};

/** The ordered image array is authoritative; image_url is legacy fallback. */
export function getPrimaryItemImage(item: ImageRecord): string | null {
  const first = item.image_urls?.find((url) => typeof url === "string" && url.trim().length > 0);
  return first ?? item.image_url ?? null;
}