import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, addDays, parseISO } from "date-fns";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { PT_FORMAT_LABEL, PtFormat } from "@/lib/ptFormat";
import { Link } from "react-router-dom";

interface Appt {
  id: string; user_id: string; instructor_id: string | null;
  format: PtFormat; starts_at: string; ends_at: string; duration_minutes: number;
  status: string; notes: string | null;
  payment_status?: string; amount_due_cents?: number;
}

interface Person { name: string; email: string; }

export default function PersonalTrainingSchedule() {
  const qc = useQueryClient();
  const [date, setDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [trainerFilter, setTrainerFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [bookOpen, setBookOpen] = useState(false);
  const [bookPreset, setBookPreset] = useState<{ id?: string; label?: string }>({});
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPreset, setSellPreset] = useState<{ id: string; label: string } | undefined>();

  const startIso = useMemo(() => new Date(`${date}T00:00:00`).toISOString(), [date]);
  const endIso = useMemo(() => new Date(`${date}T23:59:59`).toISOString(), [date]);

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["pt-appointments", date, trainerFilter, formatFilter],
    queryFn: async () => {
      let q = (supabase as any).from("pt_appointments").select("*")
        .gte("starts_at", startIso).lte("starts_at", endIso)
        .order("starts_at", { ascending: true });
      if (trainerFilter !== "all") q = q.eq("instructor_id", trainerFilter);
      if (formatFilter !== "all") q = q.eq("format", formatFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Appt[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(appts.map((a) => a.user_id))), [appts]);
  const { data: people = {} } = useQuery({
    queryKey: ["pt-appt-people", userIds],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Record<string, Person>> => {
      const [{ data: profiles }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds),
        supabase.from("members").select("user_id, email, first_name, last_name").in("user_id", userIds),
      ]);
      const map: Record<string, Person> = {};
      (profiles ?? []).forEach((p: any) => { map[p.user_id] = { name: p.full_name ?? p.email, email: p.email }; });
      (members ?? []).forEach((m: any) => { map[m.user_id] = { name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email, email: m.email }; });
      return map;
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["pt-instructors"],
    queryFn: async () => {
      const { data } = await supabase.from("instructors").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      return data ?? [];
    },
  });
  const trainerMap = useMemo(() => {
    const m: Record<string, string> = {};
    (instructors as any[]).forEach((i) => { m[i.id] = `${i.first_name} ${i.last_name}`; });
    return m;
  }, [instructors]);

  async function cancelAppt(a: Appt) {
    const reason = window.prompt("Cancellation reason (optional)") ?? "";
    if (reason === null) return;
    const { data, error } = await (supabase as any).rpc("cancel_pt_appointment", {
      p_appointment_id: a.id, p_reason: reason || null,
    });
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(cancelOutcomeMessage(row?.cancel_credit_outcome));
    supabase.functions.invoke("send-pt-booking-email", { body: { appointment_id: a.id, type: "cancellation" } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
  }


  async function setStatus(a: Appt, status: string) {
    const { error } = await (supabase as any).from("pt_appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> PT Schedule</h1>
            <p className="text-sm text-muted-foreground">Book Personal Training sessions and auto-deduct from packs.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild><Link to="/admin/personal-training/trainers">Trainers</Link></Button>
            <Button variant="outline" asChild><Link to="/admin/personal-training/passes">Customers & Packs</Link></Button>
            <Button onClick={() => { setBookPreset({}); setBookOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Book Session
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setDate(fmtDate(addDays(parseISO(date), -1), "yyyy-MM-dd"))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Button variant="outline" size="icon" onClick={() => setDate(fmtDate(addDays(parseISO(date), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(fmtDate(new Date(), "yyyy-MM-dd"))}>Today</Button>

          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any trainer</SelectItem>
              {(instructors as any[]).map((i) => (<SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : appts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            No sessions booked for {fmtDate(parseISO(date), "EEE, MMM d")}.
          </div>
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {appts.map((a) => {
              const p = people[a.user_id];
              const cancelled = a.status === "cancelled" || a.status === "late_cancel";
              return (
                <div key={a.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${cancelled ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="text-sm font-semibold tabular-nums w-20">
                      {fmtDate(parseISO(a.starts_at), "h:mm a")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p?.name ?? a.user_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {PT_FORMAT_LABEL[a.format]} · {a.duration_minutes} min
                        {a.instructor_id && trainerMap[a.instructor_id] && ` · ${trainerMap[a.instructor_id]}`}
                        {!a.instructor_id && " · Any trainer"}
                      </div>
                      {a.notes && <div className="text-xs text-muted-foreground italic truncate">{a.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.payment_status === "unpaid" && (
                      <Badge variant="destructive" className="text-[10px]">
                        Unpaid ${(((a.amount_due_cents ?? 0)) / 100).toFixed(0)}
                      </Badge>
                    )}
                    <Badge variant={a.status === "scheduled" ? "default" : a.status === "completed" ? "secondary" : "outline"} className="capitalize text-[10px]">
                      {a.status.replace("_", " ")}
                    </Badge>

                    {a.status === "scheduled" && (
                      <>
                        <Select value="" onValueChange={(v) => v && setStatus(a, v)}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Mark as…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="no_show">No-show</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => cancelAppt(a)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        presetUserId={bookPreset.id}
        presetUserName={bookPreset.label}
        presetDate={date}
        onSellPack={(id, label) => { setBookOpen(false); setSellPreset({ id, label }); setSellOpen(true); }}
      />
      <SellPTDialog
        open={sellOpen}
        onOpenChange={(v) => { setSellOpen(v); if (!v) setSellPreset(undefined); }}
        presetUserId={sellPreset?.id}
        presetUserName={sellPreset?.label}
      />
    </AdminLayout>
  );
}
