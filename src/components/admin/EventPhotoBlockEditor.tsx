import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveEventEmailImage, IMAGE_SOURCE_LABEL, type ImageSource } from "../../../supabase/functions/_shared/eventEmailImage";

type Block = { type: string; [k: string]: any };

/** Campaign Studio: pick an event and its email photo follows the event, not one shared image. */
export function EventPhotoBlockEditor({ block, onChange, onUpload }: {
  block: Block; onChange: (patch: Partial<Block>) => void; onUpload: (f: File) => void;
}) {
  const { data } = useQuery({
    queryKey: ["campaign-event-photos"],
    queryFn: async () => {
      const [{ data: ev }, { data: col }] = await Promise.all([
        supabase.from("events").select("id, title, subtitle, starts_at, image_url, email_image_url, image_alt, collection_id")
          .gte("starts_at", new Date(Date.now() - 30 * 864e5).toISOString()).order("starts_at"),
        supabase.from("ritual_collections").select("id, name, image_url, email_image_url"),
      ]);
      return { events: ev ?? [], cols: new Map((col ?? []).map((c: any) => [c.id, c])) };
    },
  });
  const pick = (id: string) => {
    const e: any = data?.events.find((x: any) => x.id === id);
    const r = resolveEventEmailImage(e, e?.collection_id ? (data!.cols.get(e.collection_id) as any) : null);
    onChange({ eventId: id, url: r.url, alt: r.alt, source: r.source, size: r.url ? (block.size ?? "large") : "none" });
  };
  const source = (block.source as ImageSource) || (block.url ? "event_email" : "logo_only");

  return (
    <div className="space-y-2">
      <Select value={block.eventId ?? ""} onValueChange={pick}>
        <SelectTrigger><SelectValue placeholder="Choose the event" /></SelectTrigger>
        <SelectContent>
          {(data?.events ?? []).map((e: any) => (
            <SelectItem key={e.id} value={e.id}>
              {e.title}{e.subtitle ? ` — ${e.subtitle}` : ""} · {formatInTimeZone(new Date(e.starts_at), "America/Detroit", "MMM d")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Using: {IMAGE_SOURCE_LABEL[source]}</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={block.size ?? "large"} onValueChange={(v) => onChange({ size: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="large">Large photo (invitations)</SelectItem>
            <SelectItem value="thumbnail">Small photo (confirmations)</SelectItem>
            <SelectItem value="none">No photo (logo only)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={block.position ?? "center"} onValueChange={(v) => onChange({ position: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Show top of photo</SelectItem>
            <SelectItem value="center">Show middle of photo</SelectItem>
            <SelectItem value="bottom">Show bottom of photo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input type="file" accept="image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <Input placeholder="Describe the photo (for screen readers)" value={block.alt ?? ""} onChange={(e) => onChange({ alt: e.target.value })} />
    </div>
  );
}
