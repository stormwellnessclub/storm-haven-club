import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image as ImageIcon, X, Upload, AlertTriangle, Loader2 } from "lucide-react";

const MAX_FILES = 10;
const SOFT_SIZE_LIMIT = 1.2 * 1024 * 1024; // 1.2 MB
const HARD_SIZE_LIMIT = 5 * 1024 * 1024; // Twilio caps ~5MB

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

export function SmsMediaPicker({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (value.length + files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} images per message.`);
      return;
    }

    setUploading(true);
    setWarning(null);
    let oversize = false;
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: only images supported.`);
        continue;
      }
      if (file.size > HARD_SIZE_LIMIT) {
        toast.error(`${file.name} is too large (max 5 MB).`);
        continue;
      }
      if (file.size > SOFT_SIZE_LIMIT) oversize = true;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("sms-media")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
        });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("sms-media").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }

    if (oversize) {
      setWarning("Some images exceed 1.2 MB. Carriers may compress them.");
    }
    onChange([...value, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || value.length >= MAX_FILES}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <ImageIcon className="h-3 w-3 mr-1" />
          )}
          Add image{value.length > 0 ? `s (${value.length}/${MAX_FILES})` : ""}
        </Button>
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Sends as MMS · ~$0.02/recipient
          </span>
        )}
      </div>

      {warning && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">{warning}</AlertDescription>
        </Alert>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative group">
              <img
                src={url}
                alt=""
                className="h-16 w-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
