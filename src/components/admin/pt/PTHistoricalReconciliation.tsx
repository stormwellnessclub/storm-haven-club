import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePTPeople, usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import { PTCard } from "@/components/admin/pt/PTUI";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  id: string; user_id: string; instructor_id: string | null; format: string; starts_at: string; status: string;
  pass_id: string | null; pack_name: string | null; sessions_remaining: number | null; sessions_total: number | null;
  package_deducted: boolean; consumed_usage_count: number;
};

const OUTCOMES: { value: string; label: string; restores: boolean }[] = [
  { value: "completed", label: "Completed", restores: false },
  { value: "no_show", label: "No-show", restores: false },
  { value: "late_client_cancel", label: "Late cancellation", restores: false },
  { value: "timely_client_cancel", label: "Timely client cancellation", restores: true },
  { value: "staff_cancel", label: "Staff cancellation", restores: true },
  { value: "facility_cancel", label: "Facility cancellation", restores: true },
];

const fmtDetroit = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function ResolveRow({ r, client, trainer }: { r: Row; client: string; trainer: string }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const chosen = OUTCOMES.find((o) => o.value === outcome);
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_resolve_historical_appointment", {
        p_appointment_id: r.id, p_outcome: outcome, p_note: note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Appointment resolved");
      qc.invalidateQueries({ queryKey: ["pt-unresolved-past"] });
      qc.invalidateQueries({ queryKey: ["pt-pass-balances"] });
      qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not resolve"),
  });
  const rem = r.sessions_remaining ?? 0;

  return (
    <div className="border-b border-border p-4 last:border-0 space-y-3">
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><div className="text-xs text-muted-foreground">Client</div>{client}</div>
        <div><div className="text-xs text-muted-foreground">Trainer</div>{trainer}</div>
        <div><div className="text-xs text-muted-foreground">Date/time</div>{fmtDetroit(r.starts_at)}</div>
        <div><div className="text-xs text-muted-foreground">Session type</div>{r.format.replace(/_/g, " ")}</div>
        <div><div className="text-xs text-muted-foreground">Package used</div>{r.pack_name ?? "—"}</div>
        <div><div className="text-xs text-muted-foreground">Package now</div>{rem} of {r.sessions_total ?? "—"} remaining</div>
        <div><div className="text-xs text-muted-foreground">Session consumed</div>{r.consumed_usage_count > 0 ? `Yes (${r.consumed_usage_count} history entry)` : "Marked deducted"}</div>
        <div><div className="text-xs text-muted-foreground">Status</div>Scheduled (past, unresolved)</div>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select true outcome" /></SelectTrigger>
          <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea className="min-h-[40px] flex-1 min-w-[200px]" placeholder="Optional historical note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {chosen && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm">
          <div>Current state: 1 session already consumed.</div>
          <div className="font-medium">
            If marked {chosen.label}: {chosen.restores ? `Restore 1 session (${rem} → ${rem + 1} remaining)` : `No additional deduction (stays ${rem} remaining)`}
          </div>
        </div>
      )}
      <Button size="sm" disabled={!outcome || m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? "Saving…" : "Save outcome"}
      </Button>
    </div>
  );
}

export function PTHistoricalReconciliation() {
  const { data: rows = [] } = useQuery({
    queryKey: ["pt-unresolved-past"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).rpc("pt_unresolved_past_appointments");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: people = {} } = usePTPeople(rows.map((r) => r.user_id));
  const trainers = usePTTrainerMap();
  if (rows.length === 0) return null;
  return (
    <PTCard padded={false} className="mb-4">
      <div className="p-4 border-b border-border">
        <div className="font-medium">Unresolved past appointments ({rows.length})</div>
        <div className="text-sm text-muted-foreground">These past sessions still say Scheduled and already used a package session. Pick what really happened — nothing changes until you save.</div>
      </div>
      {rows.map((r) => (
        <ResolveRow key={r.id} r={r} client={people[r.user_id]?.name ?? "—"} trainer={r.instructor_id ? trainers[r.instructor_id] ?? "—" : "—"} />
      ))}
    </PTCard>
  );
}
