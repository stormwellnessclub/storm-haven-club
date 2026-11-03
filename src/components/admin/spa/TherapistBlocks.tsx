import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSpaTherapists } from "@/hooks/useSpaManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Ban, Plus, Trash2, Pencil } from "lucide-react";
import { formatSpaTimeRange } from "@/lib/spaTime";
import { toast } from "sonner";

export function TherapistBlocks({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const { data: therapists } = useSpaTherapists();
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState("");
  const [start, setStart] = useState("10:30");
  const [end, setEnd] = useState("12:30");
  const [note, setNote] = useState("");
  const { data: blocks = [], isError } = useQuery({
    queryKey: ["spa-therapist-blocks", date],
    queryFn: async () => {
      const { data, error } = await supabase.from("spa_therapist_blocks").select("*").eq("block_date", date).order("start_time");
      if (error) throw error;
      return data || [];
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["spa-therapist-blocks"] });
    queryClient.invalidateQueries({ queryKey: ["spa-booked-slots"] });
    queryClient.invalidateQueries({ queryKey: ["admin-spa-appointments"] });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!therapistId || end <= start) throw new Error("Choose a therapist and an end time after the start time.");
      const payload = { therapist_id: therapistId, block_date: date, start_time: start, end_time: end, note: note.trim() };
      const result = id ? await supabase.from("spa_therapist_blocks").update(payload).eq("id", id) : await supabase.from("spa_therapist_blocks").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => { refresh(); setEditing(false); toast.success("Therapist time blocked"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from("spa_therapist_blocks").delete().eq("id", blockId);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Time block removed"); },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <section className="space-y-3 border-y border-border py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium flex items-center gap-2"><Ban className="h-4 w-4" />Therapist Time Blocks</h3>
        <Button size="sm" variant="outline" onClick={() => { setId(null); setTherapistId(""); setNote(""); setEditing(true); }}><Plus className="h-4 w-4 mr-1" />Block Time</Button>
      </div>
      {isError && <p className="text-sm text-destructive">Time blocks could not load.</p>}
      {blocks.map(block => (
        <div key={block.id} className="flex items-center gap-3 flex-wrap py-2">
          <Ban className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{therapists?.find(t => t.id === block.therapist_id)?.full_name} · {formatSpaTimeRange(block.start_time, block.end_time)}</p>
            <p className="text-sm text-muted-foreground break-words">{block.note || "Unavailable"}</p>
          </div>
          <Button size="icon" variant="ghost" title="Edit time block" aria-label="Edit time block" onClick={() => { setId(block.id); setTherapistId(block.therapist_id); setStart(block.start_time.slice(0,5)); setEnd(block.end_time.slice(0,5)); setNote(block.note); setEditing(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" title="Remove time block" aria-label="Remove time block" disabled={remove.isPending} onClick={() => { if (window.confirm("Remove this block and make the time available for booking?")) remove.mutate(block.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
      {editing && <div className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Therapist</Label><Select value={therapistId} onValueChange={setTherapistId}><SelectTrigger><SelectValue placeholder="Choose therapist" /></SelectTrigger><SelectContent>{therapists?.filter(t => t.is_active || t.id === therapistId).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="block-start">Start time</Label><Input id="block-start" type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="block-end">End time</Label><Input id="block-end" type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="block-note">Note</Label><Textarea id="block-note" value={note} onChange={e => setNote(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button disabled={save.isPending || !therapistId || !start || !end || end <= start} onClick={() => save.mutate()}>Save Block</Button></div>
      </div>}
    </section>
  );
}