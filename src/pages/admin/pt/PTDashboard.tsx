import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, parseISO } from "date-fns";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, CircleDot, Clock, DollarSign, Package,
  Plus, Sparkles, Trash2, TrendingUp, UserPlus, Users, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PT_FORMAT_LABEL, formatCents } from "@/lib/ptFormat";
import {
  PTShell, PTPageHeader, PTKpiCard, PTCard, PTSectionTitle, PTBadge, PTEmpty, ptButtonClass, PTAlert,
} from "@/components/admin/pt/PTUI";
import { usePTPeople, usePTTrainerMap, usePTTasks, usePTTaskMutations } from "@/hooks/pt/usePTPortal";
import {
  PTScheduleAppointment, PT_LIFECYCLE_LABEL, PT_LIFECYCLE_STYLE, ptLifecycle,
  usePTAlerts, useResolvePTAlert,
} from "@/hooks/pt/usePTSchedule";
import { usePTDashboard } from "@/hooks/pt/usePTDashboardData";
import { PTAppointmentDrawer } from "@/components/admin/pt/PTAppointmentDrawer";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PTDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [bookOpen, setBookOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [selected, setSelected] = useState<PTScheduleAppointment | null>(null);

  const today = new Date();
  const todayKey = fmtDate(today, "yyyy-MM-dd");

  const { data: dash, isLoading, isError, error, refetch } = usePTDashboard();
  const todays = (dash?.todaySessions ?? []) as PTScheduleAppointment[];
  const trainerMap = usePTTrainerMap();
  const peopleIds = useMemo(() => {
    const ids = todays.map((a) => a.user_id);
    (dash?.expiringPasses ?? []).forEach((p: any) => ids.push(p.user_id));
    (dash?.reassessments ?? []).forEach((p: any) => ids.push(p.user_id));
    return ids;
  }, [todays, dash]);
  const { data: people = {} } = usePTPeople(peopleIds);
  const { data: tasks = [] } = usePTTasks();
  const { create, toggle, remove } = usePTTaskMutations();
  const { data: alerts = [] } = usePTAlerts();
  const resolveAlert = useResolvePTAlert();

  const { data: money } = useQuery({
    queryKey: ["pt-dashboard", "money"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_appointments")
        .select("amount_due_cents")
        .eq("payment_status", "unpaid");
      return { outstanding: (data ?? []).reduce((s: number, r: any) => s + (r.amount_due_cents || 0), 0) };
    },
  });

  const completedToday = todays.filter((a) => a.status === "completed").length;
  const completedThisWeek = (dash?.weekSessions ?? []).filter((a: any) => a.status === "completed").length;
  const lowBalance = (dash?.passes ?? []).filter((p: any) => p.sessions_remaining > 0 && p.sessions_remaining <= 2);

  const recentCheckIns = useMemo(
    () => todays.filter((a) => a.checked_in_at).sort((a, b) => (b.checked_in_at! > a.checked_in_at! ? 1 : -1)).slice(0, 6),
    [todays],
  );

  const kpis = [
    { label: "Today's sessions", value: todays.filter((a) => ptLifecycle(a) !== "cancelled").length, hint: `${completedToday} completed`, icon: CalendarDays, tone: undefined, to: "/admin/pt/schedule" },
    { label: "Active clients", value: dash?.activeClientIds.length ?? 0, hint: "With sessions remaining", icon: Users, tone: "gold" as const, to: "/admin/pt/clients" },
    { label: "Sessions banked", value: dash?.sessionsBanked ?? 0, hint: `${lowBalance.length} low balance`, icon: TrendingUp, tone: undefined, to: "/admin/pt/packages" },
    { label: "Completed this week", value: completedThisWeek, hint: "Mon–Sun", icon: Check, tone: "green" as const, to: "/admin/pt/reports" },
    { label: "Outstanding", value: formatCents(money?.outstanding ?? 0), hint: "Unpaid sessions", icon: DollarSign, tone: (money?.outstanding ?? 0) > 0 ? ("red" as const) : ("green" as const), to: "/admin/personal-training/payments" },
    { label: "Package usage", value: `${dash?.packageUsagePct ?? 0}%`, hint: "Of sold sessions used", icon: Package, tone: undefined, to: "/admin/pt/packages" },
    { label: "New leads (30d)", value: dash?.newLeads.length ?? 0, hint: "Prospects to convert", icon: UserPlus, tone: "gold" as const, to: "/admin/pt/clients" },
    { label: "Cancels / no-shows", value: `${dash?.cancellationsThisWeek ?? 0} / ${dash?.noShowsThisWeek ?? 0}`, hint: "This week", icon: XCircle, tone: (dash?.noShowsThisWeek ?? 0) > 0 ? ("red" as const) : undefined, to: "/admin/pt/reports" },
  ];

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

      {isError && (
        <PTAlert
          tone="danger"
          title="Today's data could not be loaded"
          action={<button className={ptButtonClass("outline")} onClick={() => refetch()}>Retry</button>}
        >
          {(error as any)?.message ?? "These counts are not accurate right now — retry before acting on them."}
        </PTAlert>
      )}



      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((k) => (
          <button key={k.label} className="text-left" onClick={() => navigate(k.to)}>
            <PTKpiCard label={k.label} value={k.value} hint={k.hint} icon={k.icon} tone={k.tone} />
          </button>
        ))}
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
                  const life = ptLifecycle(a);
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
                          onClick={() => setSelected(a)}
                        >
                          {p?.name ?? "Client"}
                        </button>
                        <div className="text-xs text-pt-muted truncate">
                          {PT_FORMAT_LABEL[a.format]} · {a.instructor_id ? trainerMap[a.instructor_id] ?? "Trainer" : "Unassigned"}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <PTBadge tone={PT_LIFECYCLE_STYLE[life].badge}>{PT_LIFECYCLE_LABEL[life]}</PTBadge>
                          {a.payment_status === "unpaid" && a.amount_due_cents ? (
                            <span className="text-[11px] text-pt-red">{formatCents(a.amount_due_cents)} owed</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                        <button className={ptButtonClass("outline")} onClick={() => setSelected(a)}>
                          Manage
                        </button>
                        <Link className={ptButtonClass("ghost")} to={`/admin/pt/clients/${a.user_id}`}>
                          Profile <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
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
                  {tasks.slice(0, 10).map((t) => (
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
            <PTSectionTitle>Client alerts</PTSectionTitle>
            <PTCard className="p-0">
              {alerts.length === 0 ? (
                <div className="p-4"><PTEmpty>No open alerts.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {alerts.slice(0, 6).map((al: any) => (
                    <li key={al.id} className="px-4 py-2.5 flex items-start gap-2">
                      <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${al.severity === "high" ? "text-pt-red" : "text-pt-amber"}`} />
                      <div className="min-w-0 flex-1">
                        <button
                          className="text-[13px] text-left hover:text-pt-gold truncate block w-full"
                          onClick={() => navigate(`/admin/pt/clients/${al.client_user_id}`)}
                        >
                          {al.message}
                        </button>
                        <div className="text-[11px] text-pt-muted capitalize">{String(al.alert_type).replace(/_/g, " ")}</div>
                      </div>
                      <button className="text-[11px] text-pt-muted hover:text-pt-green" onClick={() => resolveAlert.mutate(al.id)}>
                        resolve
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PTCard>
          </div>

          <div>
            <PTSectionTitle>Packages expiring soon</PTSectionTitle>
            <PTCard className="p-0">
              {(dash?.expiringPasses ?? []).length === 0 ? (
                <div className="p-4"><PTEmpty>Nothing expiring in 30 days.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {(dash?.expiringPasses ?? []).slice(0, 6).map((p: any) => (
                    <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <button
                        className="min-w-0 text-left hover:text-pt-gold"
                        onClick={() => navigate(`/admin/pt/clients/${p.user_id}`)}
                      >
                        <div className="text-[13px] truncate">{people[p.user_id]?.name ?? "Client"}</div>
                        <div className="text-[11px] text-pt-muted truncate">{p.pack_name}</div>
                      </button>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-pt-amber">{fmtDate(new Date(`${p.expires_at}T12:00:00`), "MMM d")}</div>
                        <div className="text-[11px] text-pt-muted">{p.sessions_remaining} left</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PTCard>
          </div>

          <div>
            <PTSectionTitle>Reassessments due</PTSectionTitle>
            <PTCard className="p-0">
              {(dash?.reassessments ?? []).length === 0 ? (
                <div className="p-4"><PTEmpty>None in the next 14 days.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {(dash?.reassessments ?? []).slice(0, 6).map((p: any) => (
                    <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <button
                        className="min-w-0 text-left hover:text-pt-gold"
                        onClick={() => navigate(`/admin/pt/clients/${p.user_id}`)}
                      >
                        <div className="text-[13px] truncate">{people[p.user_id]?.name ?? "Client"}</div>
                        <div className="text-[11px] text-pt-muted truncate">{p.name}</div>
                      </button>
                      <span className="text-[11px] text-pt-muted shrink-0">
                        {fmtDate(new Date(`${p.reassessment_date}T12:00:00`), "MMM d")}
                      </span>
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
            <PTSectionTitle>New leads</PTSectionTitle>
            <PTCard className="p-0">
              {(dash?.newLeads ?? []).length === 0 ? (
                <div className="p-4"><PTEmpty>No new prospects in 30 days.</PTEmpty></div>
              ) : (
                <ul className="divide-y divide-pt-line/70">
                  {(dash?.newLeads ?? []).slice(0, 6).map((l: any) => (
                    <li key={l.user_id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <button
                        className="min-w-0 text-left hover:text-pt-gold"
                        onClick={() => navigate(`/admin/pt/clients/${l.user_id}`)}
                      >
                        <div className="text-[13px] truncate">{l.full_name ?? l.email ?? "Prospect"}</div>
                        <div className="text-[11px] text-pt-muted truncate">{l.email ?? ""}</div>
                      </button>
                      <PTBadge tone="gold"><Sparkles className="h-3 w-3" />{fmtDate(parseISO(l.created_at), "MMM d")}</PTBadge>
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

      <PTAppointmentDrawer
        appointment={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        presetDate={todayKey}
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
