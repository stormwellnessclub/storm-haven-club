import { useState } from "react";
import { format, parse } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDollars } from "@/lib/spaPackages";
import { formatTime12h } from "@/lib/timeFormat";

type Row = {
  id: string; appointment_id: string; kind: "late_cancel" | "no_show"; user_id: string | null; amount_cents: number;
  processing_fee_cents: number | null; status: string; last_error: string | null; charged_at: string | null; resolved_note: string | null; created_at: string;
  appt?: { service_name: string | null; appointment_date: string; appointment_time: string; treatment_zone_name: string | null; guest_name: string | null } | null;
  client?: string | null;
};

const KIND = { late_cancel: "Late cancellation", no_show: "Missed appointment" } as const;
const STATUS: Record<string, string> = { owed: "Owed", charging: "Charging…", charged: "Charged", failed: "Card failed", waived: "Waived", voided: "Undone" };

/** Late-cancel and missed-appointment charges recorded automatically; staff charge the saved card or a manager waives. */
export function SpaPolicyChargesList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { hasAnyRole } = useUserRoles();
  const canWaive = hasAnyRole(["super_admin", "admin", "manager"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [waiving, setWaiving] = useState<{ id: string; note: string } | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["spa-policy-charges"],
    queryFn: async (): Promise<Row[]> => {
      const { data: rows, error } = await (supabase.from as any)("spa_policy_charges").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const list = (rows ?? []) as Row[];
      const apptIds = [...new Set(list.map((r) => r.appointment_id))];
      const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
      const [{ data: appts }, { data: profs }] = await Promise.all([
        apptIds.length ? (supabase.from as any)("spa_appointments").select("id, service_name, appointment_date, appointment_time, treatment_zone_name, guest_name").in("id", apptIds) : Promise.resolve({ data: [] }),
        userIds.length ? supabase.from("profiles").select("user_id, first_name, last_name, email").in("user_id", userIds) : Promise.resolve({ data: [] }),
      ]);
      const a = new Map((appts ?? []).map((x: any) => [x.id, x]));
      const p = new Map((profs ?? []).map((x: any) => [x.user_id, [x.first_name, x.last_name].filter(Boolean).join(" ") || x.email]));
      return list.map((r) => ({ ...r, appt: (a.get(r.appointment_id) as Row["appt"]) ?? null, client: (r.user_id && (p.get(r.user_id) as string)) || null }));
    },
  });

  const charge = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const { data: res, error } = await supabase.functions.invoke("spa-policy-charge", { body: { chargeId: id, idempotencyKey: crypto.randomUUID() } });
      if (error) throw error;
      if (res?.charged) toast.success(`Charged ${formatDollars(res.amountCents)} to ${res.brand}${res.last4 ? ` •••• ${res.last4}` : ""}`);
      else if (res?.success === false) toast.error(res.error ?? "Card could not be charged");
      else toast.message("Nothing left to charge");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not charge");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["spa-policy-charges"] });
    }
  };

  const waive = async () => {
    if (!waiving || !user) return;
    if (waiving.note.trim().length < 3) { toast.error("Please add a reason"); return; }
    const { error } = await (supabase.from as any)("spa_policy_charges")
      .update({ status: "waived", resolved_by: user.id, resolved_note: waiving.note.trim(), updated_at: new Date().toISOString() })
      .eq("id", waiving.id);
    if (error) toast.error("Could not waive"); else toast.success("Charge waived");
    setWaiving(null);
    qc.invalidateQueries({ queryKey: ["spa-policy-charges"] });
  };

  return (
    <div className="mt-8">
      <h4 className="font-semibold">Late cancellations &amp; missed appointments</h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Added automatically when a client cancels within 24 hours or is marked a no-show. Late cancellations are charged to the client's card right away; if that fails, or for missed appointments, charge it here. Missed series treatments are simply used and don't appear here. Cards are charged the standard processing fee.
      </p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <p className="text-sm text-destructive">Could not load charges.</p> : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Client</th><th className="pb-2 font-medium">Appointment</th><th className="pb-2 font-medium">Reason</th>
                <th className="pb-2 font-medium">Amount</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const open = r.status === "owed" || r.status === "failed";
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-2 pr-2">{r.client ?? r.appt?.guest_name ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {[r.appt?.service_name, r.appt?.treatment_zone_name].filter(Boolean).join(" · ") || "—"}
                      {r.appt && <span className="block text-xs text-muted-foreground">{format(parse(r.appt.appointment_date, "yyyy-MM-dd", new Date()), "EEE, MMM d, yyyy")} · {formatTime12h(r.appt.appointment_time.slice(0, 5))}</span>}
                    </td>
                    <td className="py-2 pr-2">{KIND[r.kind]}</td>
                    <td className="py-2 pr-2">{formatDollars(r.amount_cents)}{r.processing_fee_cents ? <span className="block text-xs text-muted-foreground">+ {formatDollars(r.processing_fee_cents)} card fee</span> : null}</td>
                    <td className={`py-2 pr-2 ${r.status === "failed" ? "text-destructive" : ""}`}>
                      {STATUS[r.status] ?? r.status}
                      {r.status === "failed" && r.last_error && <span className="block text-xs">{r.last_error}</span>}
                      {r.status === "waived" && r.resolved_note && <span className="block text-xs text-muted-foreground">{r.resolved_note}</span>}
                    </td>
                    <td className="py-2 text-right">
                      {open && (waiving?.id === r.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input value={waiving.note} onChange={(e) => setWaiving({ id: r.id, note: e.target.value })} placeholder="Reason" className="h-8 w-44" maxLength={200} />
                          <Button size="sm" onClick={waive}>Waive</Button>
                          <Button size="sm" variant="ghost" onClick={() => setWaiving(null)}>Back</Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={!!busy || !r.user_id} onClick={() => charge(r.id)}>{busy === r.id ? "Charging…" : "Charge card"}</Button>
                          {canWaive && <Button size="sm" variant="outline" onClick={() => setWaiving({ id: r.id, note: "" })}>Waive</Button>}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
