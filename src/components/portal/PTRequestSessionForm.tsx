import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PT_REQUEST_NOTE_MAX } from "@/lib/ptRequestForm";
import { PTOpenTimes, ptErrText as errText } from "@/components/portal/PTOpenTimes";

interface Options { open: boolean; reason?: "not_client" | "closed" | null; services: { id: string; name: string; duration_minutes: number; trainers: { id: string; name: string }[] }[] }

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" /><p>{children}</p></div>;
}

/**
 * Client PT request: service → every trainer's open one-hour times together (server-derived, times only).
 * Sends a REQUEST for staff to confirm; it never creates an appointment. Times come only from the trainers' set availability; there is no free-form fallback.
 */
export function PTRequestSessionForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");

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

  const slotKey = slot && trainerId ? `${slot}|${trainerId}` : null;

  const pickService = (id: string) => {
    setServiceId(id); setSlot(null);
    const t = services.find((s) => s.id === id)?.trainers ?? [];
    setTrainerId(t.length === 1 ? t[0].id : "");
  };

  const ready = !!serviceId && !!trainerId && !!slot;

  const submit = useMutation({
    mutationFn: async () => {
      const args = { p_session_type_id: serviceId, p_trainer_id: trainerId, p_client_note: note.trim() || null, p_slot_starts_at: slot };
      const { error } = await (supabase.rpc as any)("pt_request_create", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent — awaiting confirmation");
      setSlot(null); setNote("");
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
        <p className="text-sm text-muted-foreground">Choose a session, then pick an open one-hour time with any of our trainers.</p>
      </div>
      <Notice><strong className="text-foreground">This is a session request, not a confirmed booking.</strong> We'll review your request and send a confirmation once it's scheduled.</Notice>

      {!options.data?.open || services.length === 0 ? (
        <Badge variant="secondary">{options.data?.reason === "not_client"
          ? "Session requests are for personal training clients. Please contact the club to get started."
          : "Online requests aren't open right now. Please contact the club."}</Badge>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Session</Label>
            <Select value={serviceId} onValueChange={pickService}><SelectTrigger aria-label="Session"><SelectValue placeholder="Choose a session" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</SelectItem>)}</SelectContent></Select></div>

          {serviceId && (
            <PTOpenTimes sessionTypeId={serviceId} durationMinutes={service?.duration_minutes ?? 60} selectedKey={slotKey}
              onPick={(p) => { setSlot(p.iso); setTrainerId(p.trainerId); }} />
          )}

          {serviceId && slot && (
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
