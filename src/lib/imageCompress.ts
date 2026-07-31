/**
 * Downscales + re-encodes an image file in the browser before upload.
 * Phone camera shots are frequently 4-8 MB; progress photos only need
 * enough resolution for side-by-side comparison.
 */
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Never block an upload because compression failed.
    return file;
  }
}
