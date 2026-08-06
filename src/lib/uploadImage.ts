import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";

/**
 * Uploads an image through the `upload-image` edge function (service-role write,
 * staff-verified). Falls back to a direct storage upload if the function is
 * unavailable. Images are compressed client-side first so phone photos don't
 * blow past request limits.
 */
export async function uploadImageToBucket(bucket: string, file: File): Promise<string> {
  const prepared = await compressImage(file, { maxDimension: 1800, quality: 0.85 });

  const form = new FormData();
  form.append("file", prepared, prepared.name);
  form.append("bucket", bucket);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke("upload-image", {
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!error && data?.url) return data.url as string;

  if (error) console.error("[uploadImageToBucket] edge upload failed:", error);

  // Fallback: direct storage upload (works for admins under storage RLS)
  const rawExt = prepared.name.includes(".") ? prepared.name.split(".").pop()!.toLowerCase() : "";
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : (prepared.type.split("/")[1] || "jpg");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, prepared, {
    upsert: true,
    contentType: prepared.type || undefined,
    cacheControl: "3600",
  });
  if (upErr) throw new Error(upErr.message || "Upload failed");
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
