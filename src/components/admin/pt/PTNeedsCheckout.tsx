import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PTCard, PTBadge, ptButtonClass } from "@/components/admin/pt/PTUI";
import { usePTPeople, usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import type { PTScheduleAppointment } from "@/hooks/pt/usePTSchedule";

/** Past sessions never checked out — completed or not, staff can see and settle them here. */
export function PTNeedsCheckout({ onOpen }: { onOpen: (a: PTScheduleAppointment) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { data: rows = [] } = useQuery({
    queryKey: ["pt-appointments", "needs-checkout"],
    queryFn: async (): Promise<PTScheduleAppointment[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments").select("*")
        .eq("status", "scheduled").eq("is_waitlist", false)
        .lt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: people = {} } = usePTPeople(rows.map((r) => r.user_id));
  const trainerMap = usePTTrainerMap();

  async function complete(a: PTScheduleAppointment, deduct: boolean) {
    setBusy(a.id);
    const { data, error } = await (supabase as any).rpc("pt_complete_session", {
      p_appointment_id: a.id, p_note: {}, p_deduct: deduct,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message?.includes("PACKAGE_DEDUCTION_FAILED")
        ? "No package session left to deduct — complete without credit or sell a package."
        : error.message);
      return;
    }
    const left = (data as any)?.sessions_remaining;
    toast.success(`Completed${(data as any)?.deducted ? ` · 1 credit used${typeof left === "number" ? ` · ${left} left` : ""}` : ""}`);
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
  }

  if (rows.length === 0) return null;

  return (
    <PTCard className="p-4">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="pt-eyebrow">Needs checkout</div>
          <div className="text-sm text-pt-ink">{rows.length} past session{rows.length === 1 ? "" : "s"} never marked complete, no-show or cancelled</div>
        </div>
        <span className="text-xs text-pt-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 divide-y divide-pt-line/70">
          {rows.map((a) => (
            <li key={a.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <button className="flex-1 min-w-[200px] text-left" onClick={() => onOpen(a)}>
                <div className="font-medium text-pt-ink">{people[a.user_id]?.name ?? "Client"}</div>
                <div className="text-xs text-pt-muted">
                  {fmtDate(parseISO(a.starts_at), "EEE MMM d, h:mm a")} · {a.instructor_id ? trainerMap[a.instructor_id] ?? "Trainer" : "Unassigned"}
                </div>
              </button>
              {a.package_deducted && <PTBadge tone="gold">Credit already used</PTBadge>}
              <button className={ptButtonClass("primary")} disabled={busy === a.id} onClick={() => complete(a, true)}>
                {a.package_deducted ? "Mark complete" : "Complete & deduct"}
              </button>
              {!a.package_deducted && (
                <button className={ptButtonClass("outline")} disabled={busy === a.id} onClick={() => complete(a, false)}>
                  Complete, no credit
                </button>
              )}
              <button className={ptButtonClass("outline")} onClick={() => onOpen(a)}>More</button>
            </li>
          ))}
        </ul>
      )}
    </PTCard>
  );
}
