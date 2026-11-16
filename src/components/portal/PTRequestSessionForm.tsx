import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PT_REQUEST_NOTE_MAX, PT_MAX_PENDING_REQUESTS, PT_WINDOW_TIMES, togglePTDayPick, ptWindowProblem, ptClockLabel, type PTDayPick } from "@/lib/ptRequestForm";
import { PTOpenTimes, ptErrText as errText } from "@/components/portal/PTOpenTimes";

interface Options { open: boolean; reason?: "not_allowed" | "closed" | null; is_pt_client?: boolean; services: { id: string; name: string; duration_minutes: number; trainers: { id: string; name: string }[] }[] }

const PACKAGE_INTEREST_NOTE = "New client: would like to buy a training package.";

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
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [picks, setPicks] = useState<PTDayPick[]>([]);
  const [wantsPackage, setWantsPackage] = useState(false);

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
  const newClient = options.data?.open === true && options.data?.is_pt_client === false;
  const service = services.find((s) => s.id === serviceId);

  const selectedKeys = picks.map((p) => `${p.iso}|${p.trainerId}`);

  const pickService = (id: string) => { setServiceId(id); setPicks([]); };
  const changeMode = (m: "single" | "multi") => { setMode(m); if (m === "single") setPicks((p) => p.slice(0, 1)); };
  const onPick = (p: Pick<PTDayPick, "day" | "iso" | "trainerId" | "trainer" | "time">) => {
    const r = togglePTDayPick(picks, p, mode);
    if (r.problem) toast.error(r.problem);
    setPicks(r.picks);
  };
  const updatePick = (iso: string, trainerId: string, patch: Partial<PTDayPick>) =>
    setPicks((all) => all.map((p) => (p.iso === iso && p.trainerId === trainerId ? { ...p, ...patch } : p)));

  const ready = !!serviceId && picks.length > 0 && picks.every((p) => !ptWindowProblem(p));

  // One request per picked day, each with its own note. Days that fail stay picked so the client can retry.
  const submit = useMutation({
    mutationFn: async () => {
      const failed: { pick: PTDayPick; message: string }[] = [];
      let sent = 0;
      for (const p of picks) {
        const parts = [newClient && wantsPackage ? PACKAGE_INTEREST_NOTE : "", p.note.trim()].filter(Boolean);
        const args = { p_session_type_id: serviceId, p_trainer_id: p.trainerId, p_client_note: parts.join(" ").slice(0, PT_REQUEST_NOTE_MAX) || null, p_slot_starts_at: p.iso,
          p_flexibility: p.flexibility, p_earliest_time: p.flexibility === "window" ? p.earliest : null, p_latest_time: p.flexibility === "window" ? p.latest : null };
        const { error } = await (supabase.rpc as any)("pt_request_create", args);
        if (error) failed.push({ pick: p, message: errText(error) }); else sent++;
      }
      return { sent, failed };
    },
    onSuccess: ({ sent, failed }) => {
      qc.invalidateQueries({ queryKey: ["pt-my-requests"] });
      qc.invalidateQueries({ queryKey: ["pt-client-request-times"] });
      if (sent > 0) toast.success(sent === 1 ? "Request sent — awaiting confirmation" : `${sent} requests sent — awaiting confirmation`);
      for (const f of failed) toast.error(`${f.pick.day}, ${f.pick.time}: ${f.message}`);
      setPicks(failed.map((f) => f.pick));
      if (failed.length === 0) { setWantsPackage(false); onSubmitted?.(); }
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
        <Badge variant="secondary">{options.data?.reason === "not_allowed"
          ? "Please contact the club to request a session."
          : "Online requests aren't open right now. Please contact the club."}</Badge>
      ) : (
        <div className="space-y-4">
          {newClient && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm" data-testid="pt-new-client-notice">
              <p><strong>You're not currently a personal training client.</strong> You can still send a request. The club will review it and reach out about pricing and packages before anything is booked.</p>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={wantsPackage} onCheckedChange={(v) => setWantsPackage(v === true)} aria-label="I'd like to buy a training package" className="mt-0.5" />
                <span>I'd like to buy a training package</span>
              </label>
              <Link to="/personal-training" className="text-xs underline text-muted-foreground">See training options</Link>
            </div>
          )}
          <div className="space-y-1.5"><Label>Session</Label>
            <Select value={serviceId} onValueChange={pickService}><SelectTrigger aria-label="Session"><SelectValue placeholder="Choose a session" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</SelectItem>)}</SelectContent></Select></div>

          {serviceId && (
            <div className="space-y-1.5">
              <Label>How many days?</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How many days">
                {([["single", "One day"], ["multi", "Multiple days"]] as const).map(([m, label]) => (
                  <Button key={m} type="button" size="sm" role="radio" aria-checked={mode === m}
                    variant={mode === m ? "default" : "outline"} className="normal-case tracking-normal" onClick={() => changeMode(m)}>{label}</Button>
                ))}
              </div>
              {mode === "multi" && <p className="text-xs text-muted-foreground">Pick one time on each day you'd like, up to {PT_MAX_PENDING_REQUESTS} days. Each day is its own request.</p>}
            </div>
          )}

          {serviceId && (
            <PTOpenTimes sessionTypeId={serviceId} durationMinutes={service?.duration_minutes ?? 60} selectedKeys={selectedKeys} onPick={onPick} />
          )}

          {serviceId && picks.length > 0 && (
            <div className="space-y-3" data-testid="pt-request-picks">
              <Label>{picks.length === 1 ? "Your request" : `Your requests (${picks.length} days)`}</Label>
              {picks.map((p, i) => {
                const id = `pt-note-${i}`;
                return (
                  <div key={`${p.iso}|${p.trainerId}`} className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm"><strong>{p.day}</strong> · {p.time} · {p.trainer}</p>
                      {mode === "multi" && (
                        <Button type="button" size="sm" variant="ghost" className="h-auto px-2 py-1 normal-case tracking-normal text-xs"
                          onClick={() => onPick(p)}>Remove</Button>
                      )}
                    </div>
                    <div className="space-y-1.5" data-testid="pt-request-window">
                      <p className="text-sm font-medium">Availability Window</p>
                      <div className={cn("flex items-center gap-2", p.flexibility === "exact" && "opacity-50")}>
                        <Select value={p.earliest} disabled={p.flexibility === "exact"} onValueChange={(v) => updatePick(p.iso, p.trainerId, { earliest: v })}>
                          <SelectTrigger aria-label={`Window from, ${p.day}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{PT_WINDOW_TIMES.slice(0, -1).map((t) => <SelectItem key={t} value={t}>{ptClockLabel(t)}</SelectItem>)}</SelectContent>
                        </Select>
                        <span aria-hidden>–</span>
                        <Select value={p.latest} disabled={p.flexibility === "exact"} onValueChange={(v) => updatePick(p.iso, p.trainerId, { latest: v })}>
                          <SelectTrigger aria-label={`Window to, ${p.day}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{PT_WINDOW_TIMES.slice(1).map((t) => <SelectItem key={t} value={t}>{ptClockLabel(t)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">We can confirm a time at any point within this window if your exact requested time isn't available.</p>
                      {ptWindowProblem(p) && <p className="text-xs text-destructive">{ptWindowProblem(p)}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Flexibility</p>
                      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Flexibility, ${p.day}`}>
                        {([["window", "Flexible within my window"], ["exact", "Only at my preferred time"]] as const).map(([f, label]) => (
                          <Button key={f} type="button" size="sm" role="radio" aria-checked={p.flexibility === f}
                            variant={p.flexibility === f ? "default" : "outline"} className="h-auto whitespace-normal py-2 normal-case tracking-normal"
                            onClick={() => updatePick(p.iso, p.trainerId, { flexibility: f })}>
                            {p.flexibility === f && <Check className="mr-1 h-4 w-4 shrink-0" aria-hidden />}{label}</Button>
                        ))}
                      </div>
                    </div>
                    <Label htmlFor={id} className="text-xs">Notes for {p.day} (optional)</Label>
                    <Textarea id={id} maxLength={PT_REQUEST_NOTE_MAX} value={p.note} onChange={(e) => updatePick(p.iso, p.trainerId, { note: e.target.value })}
                      placeholder="Any additional details (e.g., focus areas or preferences)" />
                    <p className="text-right text-xs text-muted-foreground">{p.note.length} / {PT_REQUEST_NOTE_MAX}</p>
                  </div>
                );
              })}
            </div>
          )}

          <Button className="w-full" size="lg" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Sending…" : picks.length > 1 ? `Request ${picks.length} Sessions` : "Request Session"}
          </Button>
        </div>
      )}
    </div>
  );
}
