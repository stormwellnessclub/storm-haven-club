import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";

/**
 * Uploads an image through the `upload-image` edge function (service-role write,
 * staff-verified). Images are compressed client-side first so phone photos
 * don't blow past request limits.
 */
export type ImageAttachmentTarget =
  | { type: "cafe_menu_item"; id: string }
  | { type: "merch_product"; id: string };

export async function uploadImageToBucket(
  bucket: string,
  file: File,
  target?: ImageAttachmentTarget,
): Promise<string> {
  const prepared = await compressImage(file, { maxDimension: 1800, quality: 0.85 });

  const form = new FormData();
  form.append("file", prepared, prepared.name);
  form.append("bucket", bucket);
  if (target) {
    form.append("targetType", target.type);
    form.append("targetId", target.id);
  }

  // Use the existing session. Do NOT force a refresh here: refresh tokens rotate,
  // so parallel/repeat uploads would race and invalidate the staff session.
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;
  const expiresAt = session?.expires_at ?? 0;
  if (session && expiresAt * 1000 - Date.now() < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }
  const token = session?.access_token;
  if (!token) {
    throw new Error("Your login has expired. Please sign in again before uploading an image.");
  }


  const { data, error } = await supabase.functions.invoke("upload-image", {
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    let message = error.message || "Image upload failed";
    const response = "context" in error && error.context instanceof Response ? error.context : undefined;
    if (response) {
      try {
        const payload = await response.clone().json() as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // Keep the client error when the response is not JSON.
      }
    }
    console.error("[uploadImageToBucket] edge upload failed:", message);
    throw new Error(message);
  }

  if (!data?.url || typeof data.url !== "string") {
    throw new Error("The image uploaded, but no image URL was returned.");
  }
  if (target && data.attached !== true) {
    throw new Error("The file uploaded, but it was not saved to the item. Please try again.");
  }

  return data.url;
}
