import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

/**
 * Uploads an image to the private event-images bucket and hands back a long-lived
 * signed link, or lets staff paste a link instead. Shows the card crop preview.
 */
export function EventImageUploader({
  value,
  onChange,
  label = "Image",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("event-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data, error: signError } = await supabase.storage
        .from("event-images")
        .createSignedUrl(path, TEN_YEARS_SECONDS);
      if (signError) throw signError;
      onChange(data.signedUrl);
      toast.success("Image uploaded.");
    } catch (e: any) {
      toast.error(e?.message ?? "That image could not be uploaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-lg border overflow-hidden bg-muted aspect-[16/9] relative">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
            No image yet — this is how the card will crop
          </div>
        )}
        {value && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2"
            aria-label="Remove image"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          Upload a photo
        </Button>
        <Input
          placeholder="…or paste an image link"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 min-w-[220px]"
        />
      </div>
    </div>
  );
}
