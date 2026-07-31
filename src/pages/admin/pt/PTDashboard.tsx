import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, addDays, parseISO, startOfWeek, endOfWeek, isToday } from "date-fns";
import {
  CalendarDays, Users, DollarSign, TrendingUp, Plus, Check, Trash2, Clock, ArrowRight, CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PT_FORMAT_LABEL, formatCents } from "@/lib/ptFormat";
import {
  PTShell, PTPageHeader, PTKpiCard, PTCard, PTSectionTitle, PTStatus, PTEmpty, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import {
  usePTAppointments, usePTPeople, usePTTrainerMap, usePTTasks, usePTTaskMutations,
} from "@/hooks/pt/usePTPortal";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function PTDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [bookOpen, setBookOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const today = new Date();
  const dayStart = new Date(`${fmtDate(today, "yyyy-MM-dd")}T00:00:00`).toISOString();
  const dayEnd = new Date(`${fmtDate(today, "yyyy-MM-dd")}T23:59:59`).toISOString();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();

  const { data: todays = [], isLoading } = usePTAppointments({ fromIso: dayStart, toIso: dayEnd });
  const { data: weekAppts = [] } = usePTAppointments({ fromIso: weekStart, toIso: weekEnd });
  const trainerMap = usePTTrainerMap();
  const { data: people = {} } = usePTPeople(todays.map((a) => a.user_id));
  const { data: tasks = [] } = usePTTasks();
  const { create, toggle, remove } = usePTTaskMutations();

  const { data: stats } = useQuery({
    queryKey: ["pt-dashboard-stats"],
    queryFn: async () => {
      const [{ data: passes }, { data: unpaid }] = await Promise.all([
        (supabase as any).from("pt_passes").select("user_id, sessions_remaining, status").eq("status", "active"),
        (supabase as any).from("pt_appointments").select("amount_due_cents").eq("payment_status", "unpaid"),
      ]);
      const activeClients = new Set((passes ?? []).filter((p: any) => p.sessions_remaining > 0).map((p: any) => p.user_id)).size;
      const sessionsBanked = (passes ?? []).reduce((s: number, p: any) => s + (p.sessions_remaining || 0), 0);
      const outstanding = (unpaid ?? []).reduce((s: number, r: any) => s + (r.amount_due_cents || 0), 0);
      const lowBalance = (passes ?? []).filter((p: any) => p.sessions_remaining > 0 && p.sessions_remaining <= 2).length;
      return { activeClients, sessionsBanked, outstanding, lowBalance };
    },
  });

  const completedThisWeek = weekAppts.filter((a) => a.status === "completed").length;

  async function markStatus(id: string, status: string, extra: Record<string, any> = {}) {
    const { error } = await (supabase as any).from("pt_appointments").update({ status, ...extra }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
  }

  const recentCheckIns = useMemo(
    () => todays.filter((a) => a.checked_in_at).sort((a, b) => (b.checked_in_at! > a.checked_in_at! ? 1 : -1)).slice(0, 6),
    [todays]
  );

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title={fmtDate(today, "EEEE, MMMM d")}
        subtitle="Sessions, clients and coaching operations at a glance."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => setSellOpen(true)}>Sell package</button>
            <Link className={ptButtonClass("outline")} to="/admin/pt/clients">Clients</Link>
            <button className={ptButtonClass()} onClick={() => setBookOpen(true)}>
              <Plus className="h-4 w-4" /> Book session
            </button>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        <PTKpiCard label="Today's sessions" value={todays.filter((a) => a.status !== "cancelled").length}
          hint={`${todays.filter((a) => a.status === "completed").length} completed`} icon={CalendarDays} />
        <PTKpiCard label="Active clients" value={stats?.activeClients ?? 0} hint="With sessions remaining" icon={Users} tone="gold" />
        <PTKpiCard label="Sessions banked" value={stats?.sessionsBanked ?? 0} hint={`${stats?.lowBalance ?? 0} low balance`} icon={TrendingUp} />
        <PTKpiCard label="Completed this week" value={completedThisWeek} hint="Mon–Sun" icon={Check} tone="green" />
        <PTKpiCard label="Outstanding" value={formatCents(stats?.outstanding ?? 0)} hint="Unpaid sessions" icon={DollarSign}
          tone={(stats?.outstanding ?? 0) > 0 ? "red" : "green"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Timeline */}
        <div>
          <PTSectionTitle action={<Link className="text-xs text-pt-gold hover:underline" to="/admin/pt/schedule">Full schedule →</Link>}>
            Today's timeline
          </PTSectionTitle>
          <PTCard className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-pt-muted">Loading…</div>
            ) : todays.length === 0 ? (
              <div className="p-8"><PTEmpty>No sessions booked today.</PTEmpty></div>
            ) : (
              <ul className="divide-y divide-pt-line/70">
                {todays.map((a) => {
                  const p = people[a.user_id];
                  return (
                    <li key={a.id} className="flex items-start gap-4 px-4 py-3 hover:bg-pt-beige/30 transition-colors">
                      <div className="w-20 shrink-0 pt-0.5">
                        <div className="pt-serif text-lg leading-none">{fmtDate(parseISO(a.starts_at), "h:mm")}</div>
                        <div className="text-[10px] uppercase tracking-widest text-pt-muted">
                          {fmtDate(parseISO(a.starts_at), "a")} · {a.duration_minutes}m
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          className="font-medium text-[15px] hover:text-pt-gold text-left truncate block"
                          onClick={() => navigate(`/admin/pt/clients/${a.user_id}`)}
                        >
                          {p?.name ?? "Client"}
                        </button>
                        <div className="text-xs text-pt-muted truncate">
                          {PT_FORMAT_LABEL[a.format]} · {a.instructor_id ? trainerMap[a.instructor_id] ?? "Trainer" : "Unassigned"}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <PTStatus status={a.status} />
                          {a.payment_status && a.payment_status !== "pass" && <PTStatus status={a.payment_status} />}
                          {a.payment_status === "unpaid" && a.amount_due_cents ? (
                            <span className="text-[11px] text-pt-red">{formatCents(a.amount_due_cents)} owed</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                        {a.status === "scheduled" && !a.checked_in_at && (
                          <button className={ptButtonClass("outline")} onClick={() => markStatus(a.id, "scheduled", { checked_in_at: new Date().toISOString() })}>
                            Check in
                          </button>
                        )}
                        {a.status === "scheduled" && (
                          <button className={ptButtonClass()} onClick={() => markStatus(a.id, "completed", { completed_at: new Date().toISOString() })}>
                            Complete
                          </button>
                        )}
                        {a.status !== "scheduled" && (
                          <Link className={ptButtonClass("ghost")} to={`/admin/pt/clients/${a.user_id}`}>
                            Profile <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PTCard>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <div>
            <PTSectionTitle>Tasks & reminders</PTSectionTitle>
            <PTCard className="p-0">
              <TaskComposer onCreate={(v) => create.mutate(v)} />
              {tasks.length === 0 ? (
                <div className="px-4 pb-4"><PTEmpty>Nothing outstanding.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {tasks.slice(0, 12).map((t) => (
                    <li key={t.id} className="flex items-start gap-2 px-4 py-2.5 group">
                      <button
                        className="mt-0.5 h-4 w-4 rounded border border-pt-line hover:border-pt-gold grid place-items-center shrink-0"
                        onClick={() => toggle.mutate(t)}
                        aria-label="Complete task"
                      >
                        <Check className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] leading-snug">{t.title}</div>
                        <div className="text-[11px] text-pt-muted flex items-center gap-2">
                          {t.due_at && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {fmtDate(parseISO(t.due_at), "MMM d")}
                            </span>
                          )}
                          <span className="capitalize inline-flex items-center gap-1">
                            <CircleDot className={
                              t.priority === "urgent" ? "h-2.5 w-2.5 text-pt-red"
                                : t.priority === "high" ? "h-2.5 w-2.5 text-pt-amber"
                                : "h-2.5 w-2.5 text-pt-line"} />
                            {t.priority}
                          </span>
                        </div>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-pt-muted hover:text-pt-red" onClick={() => remove.mutate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PTCard>
          </div>

          <div>
            <PTSectionTitle>Recent check-ins</PTSectionTitle>
            <PTCard className="p-0">
              {recentCheckIns.length === 0 ? (
                <div className="p-4"><PTEmpty>No check-ins yet today.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {recentCheckIns.map((a) => (
                    <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] truncate">{people[a.user_id]?.name ?? "Client"}</div>
                        <div className="text-[11px] text-pt-muted">{PT_FORMAT_LABEL[a.format]}</div>
                      </div>
                      <span className="text-[11px] text-pt-muted shrink-0">
                        {fmtDate(parseISO(a.checked_in_at!), "h:mm a")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PTCard>
          </div>

          <div>
            <PTSectionTitle>Quick actions</PTSectionTitle>
            <PTCard className="grid grid-cols-2 gap-2">
              <button className={ptButtonClass("outline")} onClick={() => setBookOpen(true)}>Book session</button>
              <button className={ptButtonClass("outline")} onClick={() => setSellOpen(true)}>Sell package</button>
              <Link className={ptButtonClass("outline")} to="/admin/pt/programs">Programs</Link>
              <Link className={ptButtonClass("outline")} to="/admin/personal-training/payments">Payments</Link>
            </PTCard>
          </div>
        </div>
      </div>

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        onBooked={() => qc.invalidateQueries({ queryKey: ["pt-appointments"] })}
        onSellPack={() => { setBookOpen(false); setSellOpen(true); }}
      />
      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
    </PTShell>
  );
}

function TaskComposer({ onCreate }: { onCreate: (v: any) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");

  function submit() {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      due_at: due ? new Date(`${due}T09:00:00`).toISOString() : null,
      priority,
    });
    setTitle(""); setDue(""); setPriority("medium");
  }

  return (
    <div className="p-3 border-b border-pt-line/70 space-y-2">
      <Input
        value={title}
        placeholder="Add a task…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="h-9 bg-white border-pt-line"
      />
      <div className="flex gap-2">
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 text-xs bg-white border-pt-line" />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-8 text-xs w-28 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <button className={ptButtonClass()} onClick={submit}>Add</button>
      </div>
    </div>
  );
}
