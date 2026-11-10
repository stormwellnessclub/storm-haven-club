import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format as fmt } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PTCard, ptButtonClass } from "@/components/admin/pt/PTUI";
import { PTClientPicker } from "@/components/admin/pt/PTClientPicker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FLEX: Record<string, string> = { exact: "Exact time", window: "Within window", any_time_that_day: "Any time that day", any_day: "Any day" };
const STATUS = ["waiting", "contacted", "booked", "closed"] as const;

/**
 * Staff-only PT waitlist. Adding someone never creates an appointment and nothing is sent automatically.
 * Openings: pick a trainer/date/time to see matching waitlisted clients (oldest first).
 */
export function PTWaitlistPanel({ trainers, types, clientName }: { trainers: { id: string; name: string }[]; types: { id: string; name: string; duration_minutes: number }[]; clientName?: (id: string) => string }) {
  const qc = useQueryClient();
  const [client, setClient] = useState<{ id: string; label?: string } | null>(null);
  const [f, setF] = useState({ trainer: "", type: "", date: "", time: "", earliest: "", latest: "", flex: "window", notes: "" });
  const [open, setOpen] = useState({ trainer: "", type: "", date: "", time: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const { data: rows = [] } = useQuery({
    queryKey: ["pt-waitlist"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_waitlist").select("*").order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const matchType = types.find((t) => t.id === open.type);
  const matches = useQuery({
    queryKey: ["pt-waitlist-matches", open],
    enabled: !!open.trainer && !!open.date && !!open.time,
    queryFn: async () => {
      const start = new Date(`${open.date}T${open.time}:00`);
      const end = new Date(start.getTime() + (matchType?.duration_minutes ?? 60) * 60000);
      const { data, error } = await (supabase as any).rpc("pt_waitlist_matches", {
        p_starts_at: start.toISOString(), p_ends_at: end.toISOString(), p_instructor_id: open.trainer, p_session_type_id: open.type || null,
      });
      if (error) throw error;
      return data as any[];
    },
  });

  async function add() {
    if (!client) return toast.error("Pick a client");
    const { error } = await (supabase as any).from("pt_waitlist").insert({
      client_user_id: client.id, preferred_trainer_id: f.trainer || null, session_type_id: f.type || null,
      preferred_date: f.date || null, preferred_time: f.time || null, earliest_time: f.earliest || null,
      latest_time: f.latest || null, flexibility: f.flex, notes: f.notes.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Added to waitlist — no appointment created");
    setF({ trainer: "", type: "", date: "", time: "", earliest: "", latest: "", flex: "window", notes: "" });
    qc.invalidateQueries({ queryKey: ["pt-waitlist"] });
  }
  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from("pt_waitlist").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-waitlist"] });
  }
  const tName = (id?: string | null) => trainers.find((t) => t.id === id)?.name ?? "Any trainer";
  const sName = (id?: string | null) => types.find((t) => t.id === id)?.name ?? "Any session";
  const line = (w: any) => [w.preferred_date ? fmt(new Date(`${w.preferred_date}T00:00:00`), "MMM d") : "Any date",
    w.preferred_time?.slice(0, 5), w.earliest_time && w.latest_time ? `window ${w.earliest_time.slice(0, 5)}–${w.latest_time.slice(0, 5)}` : null,
    FLEX[w.flexibility]].filter(Boolean).join(" · ");

  const TrainerSel = ({ v, on }: { v: string; on: (v: string) => void }) => (
    <Select value={v || "any"} onValueChange={(x) => on(x === "any" ? "" : x)}>
      <SelectTrigger><SelectValue placeholder="Trainer" /></SelectTrigger>
      <SelectContent><SelectItem value="any">Any trainer</SelectItem>{trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
    </Select>
  );
  const TypeSel = ({ v, on }: { v: string; on: (v: string) => void }) => (
    <Select value={v || "any"} onValueChange={(x) => on(x === "any" ? "" : x)}>
      <SelectTrigger><SelectValue placeholder="Session type" /></SelectTrigger>
      <SelectContent><SelectItem value="any">Any session</SelectItem>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <PTCard className="space-y-4 mt-6">
      <div>
        <h3 className="text-lg font-semibold">PT waitlist</h3>
        <p className="text-xs text-muted-foreground">Staff only. Joining never books a session, and nothing is sent automatically.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="md:col-span-2"><PTClientPicker onChange={(c: any) => setClient(c)} /></div>
        <TrainerSel v={f.trainer} on={set("trainer")} />
        <TypeSel v={f.type} on={set("type")} />
        <Input type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} />
        <Input type="time" value={f.time} onChange={(e) => set("time")(e.target.value)} aria-label="Preferred time" />
        <Input type="time" value={f.earliest} onChange={(e) => set("earliest")(e.target.value)} aria-label="Earliest" />
        <Input type="time" value={f.latest} onChange={(e) => set("latest")(e.target.value)} aria-label="Latest" />
        <Select value={f.flex} onValueChange={set("flex")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FLEX).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="md:col-span-2" placeholder="Notes" value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        <button className={ptButtonClass("gold")} onClick={add}>Add to waitlist</button>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Find matches for an opening</div>
        <div className="grid gap-2 md:grid-cols-4">
          <TrainerSel v={open.trainer} on={(v) => setOpen((p) => ({ ...p, trainer: v }))} />
          <TypeSel v={open.type} on={(v) => setOpen((p) => ({ ...p, type: v }))} />
          <Input type="date" value={open.date} onChange={(e) => setOpen((p) => ({ ...p, date: e.target.value }))} />
          <Input type="time" value={open.time} onChange={(e) => setOpen((p) => ({ ...p, time: e.target.value }))} />
        </div>
        {matches.data && (
          <div className="text-sm">{matches.data.length === 0 ? "No waitlisted clients match this opening." :
            matches.data.map((m) => <div key={m.id}>• {clientName?.(m.client_user_id) ?? "Client"} · {line(m)} · added {fmt(new Date(m.created_at), "MMM d, h:mm a")}</div>)}</div>
        )}
      </div>

      <div className="divide-y border rounded-md">
        {rows.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No one on the waitlist.</div> : rows.map((w) => (
          <div key={w.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex-1 min-w-[200px]">
              <div><span className="font-medium">{clientName?.(w.client_user_id) ?? "Client"}</span> · {tName(w.preferred_trainer_id)} · {sName(w.session_type_id)}</div>
              <div className="text-xs text-muted-foreground">{line(w)} · added {fmt(new Date(w.created_at), "MMM d, h:mm a")}{w.notes ? ` · ${w.notes}` : ""}</div>
            </div>
            <Select value={w.status} onValueChange={(v) => setStatus(w.id, v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </PTCard>
  );
}
