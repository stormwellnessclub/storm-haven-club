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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ptDefaultWindow } from "@/lib/ptRequestForm";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PT_REQUEST_NOTE_MAX, PT_WINDOW_TIMES, togglePTDayPick, ptWindowProblem, ptClockLabel, type PTDayPick } from "@/lib/ptRequestForm";
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
  // The time being reviewed in the confirm pop-up (new or an already-picked day being edited).
  const [draft, setDraft] = useState<PTDayPick | null>(null);
  const [sent, setSent] = useState<PTDayPick[] | null>(null);
  // A full hour the client tapped to join its waitlist.
  const [wl, setWl] = useState<{ iso: string; trainerId: string; day: string; time: string; trainer: string; waitlisted: boolean; note: string } | null>(null);
  const joinWaitlist = useMutation({
    mutationFn: async (w: NonNullable<typeof wl>) => {
      const { error } = await (supabase.rpc as any)("pt_waitlist_join", { p_session_type_id: serviceId, p_trainer_id: w.trainerId, p_starts_at: w.iso, p_notes: w.note.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You're on the waitlist. We'll contact you if this time opens up.");
      setWl(null);
      qc.invalidateQueries({ queryKey: ["pt-client-request-times"] });
      qc.invalidateQueries({ queryKey: ["pt-my-waitlist"] });
    },
    onError: (e) => { toast.error(errText(e)); qc.invalidateQueries({ queryKey: ["pt-client-request-times"] }); },
  });

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

  const keyOf = (p: { iso: string; trainerId: string }) => `${p.iso}|${p.trainerId}`;
  const selectedKeys = picks.map(keyOf);

  const pickService = (id: string) => { setServiceId(id); setPicks([]); };
  const changeMode = (m: "single" | "multi") => { setMode(m); if (m === "single") setPicks((p) => p.slice(0, 1)); };
  // Tapping a time opens the confirm pop-up; nothing is picked until the client confirms.
  const onPick = (p: Pick<PTDayPick, "day" | "iso" | "trainerId" | "trainer" | "time">) => {
    const existing = picks.find((x) => keyOf(x) === keyOf(p));
    setDraft(existing ?? { ...ptDefaultWindow(p.iso), ...p, note: "" });
  };
  const removePick = (p: PTDayPick) => setPicks((all) => all.filter((x) => keyOf(x) !== keyOf(p)));

  // One request per picked day, each with its own window, flexibility and note. Days that fail stay picked.
  const submit = useMutation({
    mutationFn: async (list: PTDayPick[]) => {
      const failed: { pick: PTDayPick; message: string }[] = [];
      const ok: PTDayPick[] = [];
      for (const p of list) {
        const parts = [newClient && wantsPackage ? PACKAGE_INTEREST_NOTE : "", p.note.trim()].filter(Boolean);
        const args = { p_session_type_id: serviceId, p_trainer_id: p.trainerId, p_client_note: parts.join(" ").slice(0, PT_REQUEST_NOTE_MAX) || null, p_slot_starts_at: p.iso,
          p_flexibility: p.flexibility, p_earliest_time: p.flexibility === "window" ? p.earliest : null, p_latest_time: p.flexibility === "window" ? p.latest : null };
        const { error } = await (supabase.rpc as any)("pt_request_create", args);
        if (error) failed.push({ pick: p, message: errText(error) }); else ok.push(p);
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      qc.invalidateQueries({ queryKey: ["pt-my-requests"] });
      qc.invalidateQueries({ queryKey: ["pt-client-request-times"] });
      for (const f of failed) toast.error(`${f.pick.day}, ${f.pick.time}: ${f.message}`);
      setPicks(failed.map((f) => f.pick));
      setDraft(null);
      if (ok.length) { setSent(ok); setWantsPackage(false); }
    },
    onError: (e) => { toast.error(errText(e)); qc.invalidateQueries({ queryKey: ["pt-client-request-times"] }); },
  });

  const confirmDraft = () => {
    if (!draft || ptWindowProblem(draft)) return;
    if (mode === "single") { submit.mutate([draft]); return; }
    const r = togglePTDayPick(picks.filter((x) => keyOf(x) !== keyOf(draft)), draft, "multi");
    if (r.problem) { toast.error(r.problem); return; }
    setPicks(r.picks.map((x) => (keyOf(x) === keyOf(draft) ? draft : x)));
    setDraft(null);
  };

  if (options.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (sent) {
    return (
      <div className="space-y-4 pb-28 md:pb-0" data-testid="pt-request-sent">
        <div>
          <h2 className="text-lg font-semibold">Request sent</h2>
          <p className="text-sm text-muted-foreground">Here's what you asked for. We'll text or email you once it's confirmed.</p>
        </div>
        {sent.map((p) => (
          <div key={keyOf(p)} className="rounded-lg border border-border p-3 text-sm space-y-0.5">
            <p><strong>{p.day}</strong> · {p.time}</p>
            <p className="text-muted-foreground">{service?.name} · {p.trainer}</p>
            <p className="text-muted-foreground">{windowLine(p)}</p>
            {p.note.trim() && <p className="text-muted-foreground">Notes: {p.note.trim()}</p>}
            <p className="pt-1 text-xs font-medium">Requested — Awaiting Confirmation</p>
          </div>
        ))}
        <Notice>This is a request, not a confirmed booking.</Notice>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" onClick={() => { setSent(null); onSubmitted?.(); }}>View my requests</Button>
          <Button className="w-full" variant="outline" onClick={() => setSent(null)}>Request another session</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <div>
        <h2 className="text-lg font-semibold">Request a PT Session</h2>
        <p className="text-sm text-muted-foreground">Choose a session, then tap an open one-hour time with any of our trainers.</p>
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
              {mode === "multi" && <p className="text-xs text-muted-foreground">Tap one time on each day you'd like — as many days as you want. Each day is its own request.</p>}
            </div>
          )}

          {serviceId && mode === "multi" && picks.length > 0 && (
            <div className="space-y-2" data-testid="pt-request-picks">
              <Label>{`Your requests (${picks.length} day${picks.length === 1 ? "" : "s"})`}</Label>
              {picks.map((p) => (
                <div key={keyOf(p)} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p><strong>{p.day}</strong> · {p.time} · {p.trainer}</p>
                      <p className="text-xs text-muted-foreground">{windowLine(p)}</p>
                      {p.note.trim() && <p className="text-xs text-muted-foreground truncate">Notes: {p.note.trim()}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="sm" variant="ghost" className="h-auto px-2 py-1 normal-case tracking-normal text-xs" onClick={() => setDraft(p)}>Edit</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-auto px-2 py-1 normal-case tracking-normal text-xs" onClick={() => removePick(p)}>Remove</Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button className="w-full" size="lg" disabled={submit.isPending} onClick={() => submit.mutate(picks)}>
                {submit.isPending ? "Sending…" : picks.length > 1 ? `Send ${picks.length} Requests` : "Send Request"}
              </Button>
            </div>
          )}

          {serviceId && (
            <PTOpenTimes sessionTypeId={serviceId} durationMinutes={service?.duration_minutes ?? 60} selectedKeys={selectedKeys} onPick={onPick}
              onWaitlist={(w) => w.waitlisted ? toast("You're already on the waitlist for this time.") : setWl({ ...w, note: "" })} />
          )}
        </div>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && !submit.isPending && setDraft(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-8" data-testid="pt-request-confirm">
          {draft && (
            <div className="space-y-4">
              <SheetHeader className="text-left">
                <SheetTitle>Confirm your request</SheetTitle>
                <SheetDescription>{draft.day} · {draft.time}<br />{service?.name} · {draft.trainer}</SheetDescription>
              </SheetHeader>
              <PickFields p={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
              <Notice><strong className="text-foreground">This is a request, not a confirmed booking.</strong> We'll confirm by text or email.</Notice>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={submit.isPending} onClick={() => setDraft(null)}>Back</Button>
                <Button disabled={!!ptWindowProblem(draft) || submit.isPending} onClick={confirmDraft}>
                  {submit.isPending ? "Sending…" : mode === "single" ? "Confirm request" : picks.some((x) => keyOf(x) === keyOf(draft)) ? "Save day" : "Add this day"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!wl} onOpenChange={(o) => !o && !joinWaitlist.isPending && setWl(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-8" data-testid="pt-waitlist-confirm">
          {wl && (
            <div className="space-y-4">
              <SheetHeader className="text-left">
                <SheetTitle>Join the waitlist</SheetTitle>
                <SheetDescription>{wl.day} · {wl.time}<br />{service?.name} · {wl.trainer}</SheetDescription>
              </SheetHeader>
              <Notice><strong className="text-foreground">This time is full.</strong> You'll be contacted if it opens up. Joining the waitlist doesn't book or charge anything.</Notice>
              <div className="space-y-1.5">
                <Label htmlFor="pt-wl-note">Notes (optional)</Label>
                <Textarea id="pt-wl-note" maxLength={500} value={wl.note} onChange={(e) => setWl({ ...wl, note: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={joinWaitlist.isPending} onClick={() => setWl(null)}>Back</Button>
                <Button disabled={joinWaitlist.isPending} onClick={() => joinWaitlist.mutate(wl)}>{joinWaitlist.isPending ? "Joining…" : "Join waitlist"}</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function windowLine(p: PTDayPick) {
  return p.flexibility === "window" ? `Flexible: ${ptClockLabel(p.earliest)} – ${ptClockLabel(p.latest)}` : "Only at this time";
}

/** Availability window, flexibility and notes for one requested day. */
function PickFields({ p, onChange }: { p: PTDayPick; onChange: (patch: Partial<PTDayPick>) => void }) {
  const problem = ptWindowProblem(p);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5" data-testid="pt-request-window">
        <p className="text-sm font-medium">Availability Window</p>
        <div className={cn("flex items-center gap-2", p.flexibility === "exact" && "opacity-50")}>
          <Select value={p.earliest} disabled={p.flexibility === "exact"} onValueChange={(v) => onChange({ earliest: v })}>
            <SelectTrigger aria-label="Window from"><SelectValue /></SelectTrigger>
            <SelectContent>{PT_WINDOW_TIMES.slice(0, -1).map((t) => <SelectItem key={t} value={t}>{ptClockLabel(t)}</SelectItem>)}</SelectContent>
          </Select>
          <span aria-hidden>–</span>
          <Select value={p.latest} disabled={p.flexibility === "exact"} onValueChange={(v) => onChange({ latest: v })}>
            <SelectTrigger aria-label="Window to"><SelectValue /></SelectTrigger>
            <SelectContent>{PT_WINDOW_TIMES.slice(1).map((t) => <SelectItem key={t} value={t}>{ptClockLabel(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">We can confirm a time at any point within this window if your exact requested time isn't available.</p>
        {problem && <p className="text-xs text-destructive">{problem}</p>}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Flexibility</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Flexibility">
          {([["window", "Flexible within my window"], ["exact", "Only at my preferred time"]] as const).map(([f, label]) => (
            <Button key={f} type="button" size="sm" role="radio" aria-checked={p.flexibility === f}
              variant={p.flexibility === f ? "default" : "outline"} className="h-auto whitespace-normal py-2 normal-case tracking-normal"
              onClick={() => onChange({ flexibility: f })}>
              {p.flexibility === f && <Check className="mr-1 h-4 w-4 shrink-0" aria-hidden />}{label}</Button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pt-note">Notes (optional)</Label>
        <Textarea id="pt-note" maxLength={PT_REQUEST_NOTE_MAX} value={p.note} onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Any additional details (e.g., focus areas or preferences)" />
        <p className="text-right text-xs text-muted-foreground">{p.note.length} / {PT_REQUEST_NOTE_MAX}</p>
      </div>
    </div>
  );
}
