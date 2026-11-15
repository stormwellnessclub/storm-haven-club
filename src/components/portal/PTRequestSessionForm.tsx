import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ptRequestProblem, PT_REQUEST_NOTE_MAX, groupSlotsByDay, detroitToday } from "@/lib/ptRequestForm";

interface Options { open: boolean; services: { id: string; name: string; duration_minutes: number; trainers: { id: string; name: string }[] }[] }

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" /><p>{children}</p></div>;
}
const errText = (e: any) => String(e?.message ?? e ?? "Something went wrong").replace(/^[A-Z_]+:\s*/, "");

/**
 * Client PT request: service → trainer → that trainer's open request times (server-derived, times only).
 * Sends a REQUEST for staff to confirm; it never creates an appointment. Fallback: request another time.
 */
export function PTRequestSessionForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [earliest, setEarliest] = useState("10:00");
  const [latest, setLatest] = useState("13:00");
  const [flexibility, setFlexibility] = useState<"window" | "exact">("window");

  const options = useQuery({
    queryKey: ["pt-client-request-options", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_client_request_options");
      if (error) throw error;
      return data as Options;
    },
  });
  const services = options.data?.services ?? [];
  const service = services.find((s) => s.id === serviceId);
  const trainers = service?.trainers ?? [];

  const times = useQuery({
    queryKey: ["pt-client-request-times", serviceId, trainerId],
    enabled: !!serviceId && !!trainerId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_client_request_times", { p_session_type_id: serviceId, p_trainer_id: trainerId, p_days: 14 });
      if (error) throw error;
      return ((data ?? []) as { starts_at: string }[]).map((s) => s.starts_at);
    },
  });
  const days = useMemo(() => groupSlotsByDay(times.data ?? []), [times.data]);

  const pickService = (id: string) => {
    setServiceId(id); setSlot(null);
    const t = services.find((s) => s.id === id)?.trainers ?? [];
    setTrainerId(t.length === 1 ? t[0].id : "");
  };

  const problem = fallback ? ptRequestProblem({ date, time, flexibility, earliest, latest }, detroitToday()) : null;
  const ready = !!serviceId && !!trainerId && (fallback ? !problem : !!slot);

  const submit = useMutation({
    mutationFn: async () => {
      const args: Record<string, unknown> = { p_session_type_id: serviceId, p_trainer_id: trainerId, p_client_note: note.trim() || null };
      if (fallback) Object.assign(args, { p_preferred_date: date, p_preferred_time: time, p_flexibility: flexibility,
        p_earliest_time: flexibility === "window" ? earliest : null, p_latest_time: flexibility === "window" ? latest : null });
      else args.p_slot_starts_at = slot;
      const { error } = await (supabase.rpc as any)("pt_request_create", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent — awaiting confirmation");
      setSlot(null); setNote(""); setFallback(false); setDate("");
      qc.invalidateQueries({ queryKey: ["pt-my-requests"] });
      qc.invalidateQueries({ queryKey: ["pt-client-request-times"] });
      onSubmitted?.();
    },
    onError: (e) => { toast.error(errText(e)); qc.invalidateQueries({ queryKey: ["pt-client-request-times"] }); },
  });

  if (options.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <div>
        <h2 className="text-lg font-semibold">Request a PT Session</h2>
        <p className="text-sm text-muted-foreground">Choose a session and trainer, then pick one of their open times.</p>
      </div>
      <Notice><strong className="text-foreground">This is a session request, not a confirmed booking.</strong> We'll review your request and send a confirmation once it's scheduled.</Notice>

      {!options.data?.open || services.length === 0 ? (
        <Badge variant="secondary">Online requests aren't open right now. Please contact the club.</Badge>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Session</Label>
            <Select value={serviceId} onValueChange={pickService}><SelectTrigger aria-label="Session"><SelectValue placeholder="Choose a session" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</SelectItem>)}</SelectContent></Select></div>

          {service && (
            <div className="space-y-1.5"><Label>Trainer</Label>
              <Select value={trainerId} onValueChange={(v) => { setTrainerId(v); setSlot(null); }}><SelectTrigger aria-label="Trainer"><SelectValue placeholder="Choose a trainer" /></SelectTrigger>
                <SelectContent>{trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
          )}

          {serviceId && trainerId && !fallback && (
            <div className="space-y-2">
              <Label>Available times</Label>
              {times.isLoading ? <p className="text-sm text-muted-foreground">Finding open times…</p>
                : times.error ? <p className="text-sm text-destructive">{errText(times.error)}</p>
                : days.length === 0 ? <p className="text-sm text-muted-foreground">No open times in the next two weeks.</p>
                : <div className="space-y-3" data-testid="pt-request-times">{days.map((d) => (
                    <div key={d.label} className="space-y-1.5">
                      <p className="text-sm font-medium">{d.label}</p>
                      <div className="flex flex-wrap gap-2">{d.slots.map((s) => (
                        <Button key={s.iso} type="button" size="sm" variant={slot === s.iso ? "default" : "outline"}
                          className="normal-case tracking-normal" aria-pressed={slot === s.iso} onClick={() => setSlot(s.iso)}>{s.time}</Button>
                      ))}</div>
                    </div>))}</div>}
              <button type="button" className="text-sm underline text-muted-foreground" onClick={() => { setFallback(true); setSlot(null); }}>
                None of these times work? Request another time
              </button>
            </div>
          )}

          {serviceId && trainerId && fallback && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Request another time</p>
                <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setFallback(false)}>Back to open times</button>
              </div>
              <div className="space-y-1.5"><Label htmlFor="pt-date">Preferred date</Label><Input id="pt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="pt-time">Preferred time</Label><Input id="pt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Availability window</Label>
                <div className="flex items-center gap-2">
                  <Input aria-label="Window starts" type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} disabled={flexibility === "exact"} />
                  <span className="text-muted-foreground">–</span>
                  <Input aria-label="Window ends" type="time" value={latest} onChange={(e) => setLatest(e.target.value)} disabled={flexibility === "exact"} />
                </div></div>
              <div className="space-y-1.5"><Label>Flexibility</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" className="h-auto whitespace-normal py-2 normal-case tracking-normal text-xs" variant={flexibility === "window" ? "default" : "outline"} onClick={() => setFlexibility("window")}>Flexible within my window</Button>
                  <Button type="button" className="h-auto whitespace-normal py-2 normal-case tracking-normal text-xs" variant={flexibility === "exact" ? "default" : "outline"} onClick={() => setFlexibility("exact")}>Only at my preferred time</Button>
                </div></div>
              {date && problem && <p className="text-sm text-destructive">{problem}</p>}
            </div>
          )}

          {serviceId && trainerId && (
            <div className="space-y-1.5"><Label htmlFor="pt-note">Notes (optional)</Label>
              <Textarea id="pt-note" maxLength={PT_REQUEST_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any additional details (e.g., focus areas or preferences)" />
              <p className="text-right text-xs text-muted-foreground">{note.length} / {PT_REQUEST_NOTE_MAX}</p></div>
          )}

          <Button className="w-full" size="lg" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Sending…" : "Request Session"}
          </Button>
        </div>
      )}
    </div>
  );
}
