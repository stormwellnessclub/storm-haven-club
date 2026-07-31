import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, addDays, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PT_FORMAT_LABEL, PT_FORMATS, formatCents } from "@/lib/ptFormat";
import { PTShell, PTPageHeader, PTCard, PTStatus, PTEmpty, ptButtonClass } from "@/components/admin/pt/PTUI";
import { usePTAppointments, usePTPeople, usePTTrainerMap, usePTTrainers } from "@/hooks/pt/usePTPortal";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const START_HOUR = 6;
const END_HOUR = 21;
const PX_PER_MIN = 1.4;

type View = "day" | "week";

export default function PTSchedule() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [trainer, setTrainer] = useState("all");
  const [format, setFormat] = useState("all");
  const [bookOpen, setBookOpen] = useState(false);
  const [preset, setPreset] = useState<{ date?: string }>({});

  const anchor = parseISO(date);
  const rangeStart = view === "day" ? anchor : startOfWeek(anchor, { weekStartsOn: 1 });
  const days = view === "day" ? [rangeStart] : Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const fromIso = new Date(`${fmtDate(days[0], "yyyy-MM-dd")}T00:00:00`).toISOString();
  const toIso = new Date(`${fmtDate(days[days.length - 1], "yyyy-MM-dd")}T23:59:59`).toISOString();

  const { data: appts = [], isLoading } = usePTAppointments({ fromIso, toIso, trainerId: trainer, format });
  const { data: people = {} } = usePTPeople(appts.map((a) => a.user_id));
  const { data: trainers = [] } = usePTTrainers();
  const trainerMap = usePTTrainerMap();

  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i),
    []
  );

  function offsetFor(iso: string) {
    const d = parseISO(iso);
    return (d.getHours() * 60 + d.getMinutes() - START_HOUR * 60) * PX_PER_MIN;
  }

  async function cancelAppt(id: string) {
    const reason = window.prompt("Cancellation reason (optional)");
    if (reason === null) return;
    const { error } = await (supabase as any).rpc("cancel_pt_appointment", { p_appointment_id: id, p_reason: reason || null });
    if (error) return toast.error(error.message);
    toast.success("Cancelled · session restored");
    supabase.functions.invoke("send-pt-booking-email", { body: { appointment_id: id, type: "cancellation" } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
  }

  async function setStatus(id: string, status: string, extra: Record<string, any> = {}) {
    const { error } = await (supabase as any).from("pt_appointments").update({ status, ...extra }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title="Schedule"
        subtitle="Timeline of every trainer session. Click an empty slot to book."
        actions={
          <button className={ptButtonClass()} onClick={() => { setPreset({ date }); setBookOpen(true); }}>
            <Plus className="h-4 w-4" /> Book session
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={ptButtonClass("outline")} onClick={() => setDate(fmtDate(addDays(anchor, view === "day" ? -1 : -7), "yyyy-MM-dd"))}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9 bg-white border-pt-line" />
        <button className={ptButtonClass("outline")} onClick={() => setDate(fmtDate(addDays(anchor, view === "day" ? 1 : 7), "yyyy-MM-dd"))}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button className={ptButtonClass("outline")} onClick={() => setDate(fmtDate(new Date(), "yyyy-MM-dd"))}>Today</button>

        <div className="flex rounded-lg border border-pt-line overflow-hidden ml-1">
          {(["day", "week"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-[13px] capitalize ${view === v ? "bg-pt-noir text-pt-cream" : "bg-white text-pt-muted hover:text-pt-ink"}`}
            >
              {v}
            </button>
          ))}
        </div>

        <Select value={trainer} onValueChange={setTrainer}>
          <SelectTrigger className="w-44 h-9 bg-white border-pt-line"><SelectValue placeholder="All trainers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trainers</SelectItem>
            {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-52 h-9 bg-white border-pt-line"><SelectValue placeholder="All formats" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All formats</SelectItem>
            {PT_FORMATS.map((f) => <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>)}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-pt-muted">
          {appts.filter((a) => a.status !== "cancelled").length} sessions
        </span>
      </div>

      <PTCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto pt-scroll">
          <div className="min-w-[720px] flex">
            <div className="w-16 shrink-0 border-r border-pt-line/70 bg-pt-beige/20">
              <div className="h-10 border-b border-pt-line/70" />
              {hours.map((h) => (
                <div key={h} style={{ height: 60 * PX_PER_MIN }} className="relative">
                  <span className="absolute -top-2 right-2 text-[10px] uppercase tracking-widest text-pt-muted">
                    {fmtDate(new Date(2020, 0, 1, h), "h a")}
                  </span>
                </div>
              ))}
            </div>

            {days.map((d) => {
              const key = fmtDate(d, "yyyy-MM-dd");
              const dayAppts = appts.filter((a) => fmtDate(parseISO(a.starts_at), "yyyy-MM-dd") === key);
              return (
                <div key={key} className="flex-1 min-w-[200px] border-r border-pt-line/40 last:border-r-0">
                  <div className="h-10 border-b border-pt-line/70 px-3 flex items-center justify-between bg-white">
                    <div>
                      <span className="pt-eyebrow">{fmtDate(d, "EEE")}</span>{" "}
                      <span className="pt-serif text-lg">{fmtDate(d, "d")}</span>
                    </div>
                    <span className="text-[11px] text-pt-muted">{dayAppts.filter((a) => a.status !== "cancelled").length}</span>
                  </div>
                  <div className="relative" style={{ height: (END_HOUR - START_HOUR + 1) * 60 * PX_PER_MIN }}>
                    {hours.map((h) => (
                      <button
                        key={h}
                        onClick={() => { setPreset({ date: key }); setBookOpen(true); }}
                        className="absolute left-0 right-0 border-b border-pt-line/30 hover:bg-pt-beige/30"
                        style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        aria-label={`Book ${key} ${h}:00`}
                      />
                    ))}
                    {dayAppts.map((a) => {
                      const p = people[a.user_id];
                      const cancelled = a.status === "cancelled" || a.status === "late_cancel";
                      return (
                        <div
                          key={a.id}
                          className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 text-left overflow-hidden border ${
                            cancelled
                              ? "bg-pt-line/20 border-pt-line text-pt-muted"
                              : a.payment_status === "unpaid"
                              ? "bg-pt-red/5 border-pt-red/40"
                              : "bg-white border-pt-gold/50 shadow-sm"
                          }`}
                          style={{ top: offsetFor(a.starts_at), height: Math.max(a.duration_minutes * PX_PER_MIN - 4, 34) }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <button className="text-[12px] font-medium truncate hover:text-pt-gold"
                              onClick={() => navigate(`/admin/pt/clients/${a.user_id}`)}>
                              {p?.name ?? "Client"}
                            </button>
                            <span className="text-[10px] text-pt-muted shrink-0">{fmtDate(parseISO(a.starts_at), "h:mm")}</span>
                          </div>
                          <div className="text-[10px] text-pt-muted truncate">
                            {PT_FORMAT_LABEL[a.format]}{a.instructor_id ? ` · ${trainerMap[a.instructor_id] ?? ""}` : ""}
                          </div>
                          {a.duration_minutes >= 45 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <PTStatus status={a.status} />
                              {a.payment_status === "unpaid" && (
                                <span className="text-[10px] text-pt-red">{formatCents(a.amount_due_cents ?? 0)}</span>
                              )}
                              {!cancelled && (
                                <>
                                  {a.status === "scheduled" && (
                                    <button className="text-[10px] text-pt-green hover:underline"
                                      onClick={() => setStatus(a.id, "completed", { completed_at: new Date().toISOString() })}>
                                      complete
                                    </button>
                                  )}
                                  <button className="text-[10px] text-pt-red hover:underline" onClick={() => cancelAppt(a.id)}>
                                    cancel
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {!isLoading && appts.length === 0 && (
          <div className="p-6"><PTEmpty>No sessions in this range.</PTEmpty></div>
        )}
      </PTCard>

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        presetDate={preset.date}
        onBooked={() => qc.invalidateQueries({ queryKey: ["pt-appointments"] })}
      />
    </PTShell>
  );
}
