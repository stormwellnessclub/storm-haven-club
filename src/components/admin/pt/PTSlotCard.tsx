import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SlotSummary, SlotWaiter } from "@/lib/ptSlots";
import { cn } from "@/lib/utils";

/** Staff-only waitlist rows (admins/desk see all trainers, a trainer sees their own). */
export function usePTWaitlistEntries(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["pt-waitlist", "entries", fromDate, toDate],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SlotWaiter[]> => {
      const { data, error } = await (supabase as any).rpc("pt_schedule_waitlist_entries", { p_from: fromDate, p_to: toDate });
      if (error) throw error;
      return (data ?? []) as SlotWaiter[];
    },
  });
}

const STATE_TEXT = {
  requested: "Held by the first request. Approve or decline it before moving anyone up.",
  booked: "Booked. People below are waiting in case it opens.",
  opened: "Open now. Move the next person in line to a request.",
};

/** One trainer hour: who holds it and who is waiting, in order. Used on the desktop calendar and the phone app. */
export function PTSlotCard({ slot, trainerName, onOpenRequest, compact }: {
  slot: SlotSummary; trainerName?: string; onOpenRequest?: (id: string) => void; compact?: boolean;
}) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pt-waitlist"] });
    qc.invalidateQueries({ queryKey: ["pt-requests"] });
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("pt_waitlist").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const promote = async (id: string) => {
    const { data, error } = await (supabase as any).rpc("pt_waitlist_promote", { p_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Moved to requests. Review it to confirm the time.");
    refresh();
    if (data && onOpenRequest) onOpenRequest(data as string);
  };
  const start = new Date(slot.starts_at);
  return (
    <div className={cn("space-y-3 text-sm", compact && "text-[13px]")}>
      <div>
        <p className="font-semibold">{format(start, "EEE MMM d · h:mm a")}{trainerName ? ` · ${trainerName}` : ""}</p>
        <p className={cn("mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          slot.state === "opened" ? "bg-pt-gold border-pt-gold text-pt-ink" : "bg-pt-beige border-pt-line text-pt-ink")}>{slot.label}</p>
        <p className="mt-1 text-xs text-pt-muted">{STATE_TEXT[slot.state]}</p>
      </div>

      {slot.booked.map((b) => (
        <div key={b.id} className="rounded-lg border border-pt-line p-2.5">
          <span className="text-[10px] uppercase tracking-widest text-pt-muted">Booked</span>
          <p className="font-medium">{b.client_name ?? "Client"}</p>
        </div>
      ))}
      {slot.requests.map((r) => (
        <div key={r.id} className="rounded-lg border border-dashed border-pt-line p-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-widest text-pt-muted">Requested first</span>
            <p className="font-medium truncate">{r.client_name ?? "Client"}</p>
            {r.session_name && <p className="text-xs text-pt-muted truncate">{r.session_name}</p>}
          </div>
          {onOpenRequest && <button className="shrink-0 rounded-md bg-pt-ink px-3 py-2 text-xs font-semibold text-pt-cream" onClick={() => onOpenRequest(r.id)}>Review</button>}
        </div>
      ))}

      <div>
        <p className="text-[10px] uppercase tracking-widest text-pt-muted mb-1">Waitlist (in order)</p>
        {slot.waiting.map((w, i) => {
          const next = i === 0 && slot.state === "opened";
          return (
            <div key={w.id} className={cn("rounded-lg border p-2.5 mb-2", next ? "border-pt-gold bg-pt-gold/10" : "border-pt-line")}>
              <p className="font-medium">{i + 1}. {w.client_name ?? "Client"} {next && <span className="ml-1 text-[11px] text-pt-ink">· Next in line</span>}</p>
              <p className="text-xs text-pt-muted">{[w.session_name, w.phone, w.email].filter(Boolean).join(" · ")}</p>
              {w.notes && <p className="text-xs mt-0.5">Notes: {w.notes}</p>}
              <p className="text-[11px] text-pt-muted">Joined {format(new Date(w.created_at), "MMM d, h:mm a")}{w.status === "contacted" ? " · Contacted" : ""}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {slot.state === "opened" && <button className="rounded-md bg-pt-ink px-3 py-2 text-xs font-semibold text-pt-cream" onClick={() => promote(w.id)}>Move to request</button>}
                {w.status === "waiting" && <button className="rounded-md border border-pt-line px-3 py-2 text-xs" onClick={() => setStatus(w.id, "contacted")}>Contacted</button>}
                <button className="rounded-md border border-pt-line px-3 py-2 text-xs" onClick={() => setStatus(w.id, "closed")}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
