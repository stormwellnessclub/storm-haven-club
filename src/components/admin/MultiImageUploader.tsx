import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, ChevronUp, ChevronDown, Star } from "lucide-react";
import { toast } from "sonner";

interface MultiImageUploaderProps {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  /** Persists the complete URL list for an existing record. */
  onPersist?: (urls: string[]) => Promise<void>;
  /** Uploads a single file and returns the public URL */
  upload: (file: File) => Promise<string>;
  maxImages?: number;
  thumbSize?: "sm" | "md";
}

/**
 * Drop-in multi-image picker:
 * - Multi-file select uploads all in parallel
 * - Thumbnail grid with remove + reorder (↑ ↓)
 * - First image = primary/cover (marked with star)
 */
export function MultiImageUploader({
  label = "Images",
  value,
  onChange,
  onPersist,
  upload,
  maxImages = 8,
  thumbSize = "md",
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const room = maxImages - value.length;
    if (room <= 0) {
      toast.error(`Max ${maxImages} images per item`);
      return;
    }
    const toUpload = files.slice(0, room);
    setUploading(true);
    try {
      const results = await Promise.allSettled(toUpload.map(upload));
      const newUrls: string[] = [];
      const failedMsgs: string[] = [];
      results.forEach((r) => {
        if (r.status === "fulfilled") newUrls.push(r.value);
        else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error("[MultiImageUploader] upload failed:", r.reason);
          failedMsgs.push(msg);
        }
      });
      if (newUrls.length) {
        const nextUrls = [...value, ...newUrls];
        onChange(nextUrls);
        if (onPersist) {
          try {
            await onPersist(nextUrls);
          } catch (error) {
            const message = error instanceof Error ? error.message : "The file uploaded but could not be attached to this item.";
            toast.error(message);
            return;
          }
        }
      }
      if (failedMsgs.length) {
        toast.error(
          `${failedMsgs.length} image${failedMsgs.length > 1 ? "s" : ""} failed: ${failedMsgs[0]}`,
        );
      } else {
        toast.success(
          onPersist
            ? `${newUrls.length} image${newUrls.length > 1 ? "s" : ""} uploaded and saved`
            : `${newUrls.length} image${newUrls.length > 1 ? "s" : ""} ready — save the item to keep ${newUrls.length > 1 ? "them" : "it"}`,
        );
      }
      if (files.length > room) toast.message(`Only added ${room} of ${files.length} (max ${maxImages})`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applyChange = async (next: string[]) => {
    onChange(next);
    if (!onPersist) return;
    setUploading(true);
    try {
      await onPersist(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save image changes";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => void applyChange(value.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    void applyChange(next);
  };
  const makePrimary = (idx: number) => {
    if (idx === 0) return;
    const next = [...value];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    void applyChange(next);
  };

  const dim = thumbSize === "sm" ? "h-16 w-16" : "h-20 w-20";

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>
          {label} {value.length > 0 && <span className="text-muted-foreground font-normal">({value.length}/{maxImages})</span>}
        </Label>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className={`relative ${dim} rounded border bg-muted overflow-hidden group`}>
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full p-0.5" title="Primary image">
                <Star className="h-3 w-3" />
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 flex justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="text-white p-0.5 disabled:opacity-30"
                title="Move left"
              >
                <ChevronUp className="h-3 w-3 -rotate-90" />
              </button>
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  className="text-white px-1 text-[10px]"
                  title="Make primary"
                >
                  ★
                </button>
              )}
              <button
                type="button"
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                className="text-white p-0.5 disabled:opacity-30"
                title="Move right"
              >
                <ChevronDown className="h-3 w-3 -rotate-90" />
              </button>
            </div>
          </div>
        ))}
        {value.length < maxImages && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`${dim} rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50`}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[10px] mt-1">{uploading ? "Uploading" : "Add"}</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">First image is the cover. You can upload several at once.</p>
      )}
    </div>
  );
}
