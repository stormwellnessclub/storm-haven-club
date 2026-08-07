export type ImageRecord = {
  image_url?: string | null;
  image_urls?: string[] | null;
};

/** image_url is the explicit cover; the gallery is only a fallback for legacy rows. */
export function getPrimaryItemImage(item: ImageRecord): string | null {
  const first = item.image_urls?.find((url) => typeof url === "string" && url.trim().length > 0);
  return item.image_url ?? first ?? null;
}