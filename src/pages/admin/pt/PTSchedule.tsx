import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, addDays, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { PT_FORMAT_LABEL, formatCents } from "@/lib/ptFormat";
import { PTShell, PTPageHeader, PTCard, PTEmpty, PTBadge, ptButtonClass } from "@/components/admin/pt/PTUI";
import { usePTPeople, usePTTrainerMap, usePTTrainers } from "@/hooks/pt/usePTPortal";
import {
  PTScheduleAppointment, PT_LIFECYCLE_LABEL, PT_LIFECYCLE_STYLE, ptLifecycle,
  usePTLookupMaps, usePTScheduleAppointments,
} from "@/hooks/pt/usePTSchedule";
import { PTAppointmentDrawer } from "@/components/admin/pt/PTAppointmentDrawer";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const START_HOUR = 6;
const END_HOUR = 21;
const PX_PER_MIN = 1.5;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

type View = "day" | "week" | "trainer" | "location";

export default function PTSchedule() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [trainer, setTrainer] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [presetDate, setPresetDate] = useState<string | undefined>();
  const [selected, setSelected] = useState<PTScheduleAppointment | null>(null);

  const anchor = parseISO(date);
  const weekMode = view === "week";
  const rangeStart = weekMode ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor;
  const days = weekMode ? Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)) : [rangeStart];
  const fromIso = new Date(`${fmtDate(days[0], "yyyy-MM-dd")}T00:00:00`).toISOString();
  const toIso = new Date(`${fmtDate(days[days.length - 1], "yyyy-MM-dd")}T23:59:59`).toISOString();

  const { data: rows = [], isLoading } = usePTScheduleAppointments({
    fromIso, toIso, trainerId: trainer, locationId: locationFilter,
    sessionTypeId: sessionTypeFilter, status: statusFilter,
  });
  const { data: people = {} } = usePTPeople(rows.map((a) => a.user_id));
  const { data: trainers = [] } = usePTTrainers();
  const trainerMap = usePTTrainerMap();
  const { locations, sessionTypes, locationMap, sessionTypeMap } = usePTLookupMaps();

  const appts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const p = people[a.user_id];
      return (p?.name ?? "").toLowerCase().includes(q) || (p?.email ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, people]);

  const activeCount = appts.filter((a) => !["cancelled", "no_show"].includes(ptLifecycle(a))).length;

  /** Columns depend on view: days, trainers, or locations. */
  const columns = useMemo(() => {
    if (view === "trainer") {
      const ids = trainer === "all" ? trainers.map((t) => t.id) : [trainer];
      const cols = ids.map((id) => ({
        key: id,
        title: trainerMap[id] ?? "Trainer",
        subtitle: "",
        match: (a: PTScheduleAppointment) => a.instructor_id === id,
      }));
      cols.push({
        key: "unassigned", title: "Unassigned", subtitle: "",
        match: (a: PTScheduleAppointment) => !a.instructor_id,
      });
      return cols;
    }
    if (view === "location") {
      const list = locationFilter === "all" ? locations : locations.filter((l) => l.id === locationFilter);
      const cols = list.map((l) => ({
        key: l.id,
        title: l.name,
        subtitle: l.code ?? "",
        match: (a: PTScheduleAppointment) => a.location_id === l.id,
      }));
      cols.push({
        key: "nolocation", title: "No location", subtitle: "",
        match: (a: PTScheduleAppointment) => !a.location_id,
      });
      return cols;
    }
    return days.map((d) => {
      const key = fmtDate(d, "yyyy-MM-dd");
      return {
        key,
        title: fmtDate(d, "EEE"),
        subtitle: fmtDate(d, "MMM d"),
        match: (a: PTScheduleAppointment) => a.starts_at.slice(0, 10) === key,
      };
    });
  }, [view, days, trainers, trainerMap, trainer, locations, locationFilter]);

  function offsetFor(iso: string) {
    const d = parseISO(iso);
    return (d.getHours() * 60 + d.getMinutes() - START_HOUR * 60) * PX_PER_MIN;
  }

  /**
   * Side-by-side layout for overlapping sessions (semi-private groups book one
   * appointment per attendee in the same slot — they must all stay visible).
   */
  function layoutColumn(list: PTScheduleAppointment[]) {
    const sorted = [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const lanes: Record<string, { lane: number; lanes: number }> = {};
    let cluster: PTScheduleAppointment[] = [];
    let clusterEnd = 0;
    const flush = () => {
      const laneEnds: number[] = [];
      cluster.forEach((a) => {
        const start = new Date(a.starts_at).getTime();
        const end = new Date(a.ends_at ?? a.starts_at).getTime() || start + a.duration_minutes * 60000;
        let lane = laneEnds.findIndex((e) => e <= start);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
        lanes[a.id] = { lane, lanes: 0 };
      });
      cluster.forEach((a) => { lanes[a.id].lanes = laneEnds.length; });
      cluster = [];
    };
    sorted.forEach((a) => {
      const start = new Date(a.starts_at).getTime();
      const end = new Date(a.ends_at ?? a.starts_at).getTime() || start + a.duration_minutes * 60000;
      if (cluster.length && start >= clusterEnd) flush();
      cluster.push(a);
      clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
    });
    if (cluster.length) flush();
    return lanes;
  }



  function step(dir: number) {
    setDate(fmtDate(addDays(anchor, weekMode ? dir * 7 : dir), "yyyy-MM-dd"));
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title="Schedule"
        subtitle="Day, week, trainer and location views. Click any slot to book, any card to manage."
        actions={
          <button className={ptButtonClass()} onClick={() => { setPresetDate(date); setBookOpen(true); }}>
            <Plus className="h-4 w-4" /> Book session
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={ptButtonClass("outline")} onClick={() => step(-1)} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-9 bg-white border-pt-line" />
        <button className={ptButtonClass("outline")} onClick={() => step(1)} aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        <button className={ptButtonClass("outline")} onClick={() => setDate(fmtDate(new Date(), "yyyy-MM-dd"))}>Today</button>

        <div className="flex rounded-lg border border-pt-line overflow-hidden ml-1">
          {(["day", "week", "trainer", "location"] as View[]).map((v) => (
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
          <SelectTrigger className="w-40 h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trainers</SelectItem>
            {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-40 h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sessionTypeFilter} onValueChange={setSessionTypeFilter}>
          <SelectTrigger className="w-44 h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All session types</SelectItem>
            {sessionTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(PT_LIFECYCLE_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-pt-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client"
            className="h-9 w-48 pl-8 bg-white border-pt-line"
          />
        </div>

        <span className="ml-auto text-xs text-pt-muted">{activeCount} active sessions</span>
      </div>

      <PTCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto pt-scroll">
          <div className="min-w-[760px] flex">
            <div className="w-16 shrink-0 border-r border-pt-line/70 bg-pt-beige/20">
              <div className="h-12 border-b border-pt-line/70" />
              {HOURS.map((h) => (
                <div key={h} style={{ height: 60 * PX_PER_MIN }} className="relative">
                  <span className="absolute -top-2 right-2 text-[10px] uppercase tracking-widest text-pt-muted">
                    {fmtDate(new Date(2020, 0, 1, h), "h a")}
                  </span>
                </div>
              ))}
            </div>

            {columns.map((col) => {
              const colAppts = appts.filter(col.match);
              const laneMap = layoutColumn(colAppts);

              const bookDate = view === "week" ? col.key : date;
              return (
                <div key={col.key} className="flex-1 min-w-[210px] border-r border-pt-line/40 last:border-r-0">
                  <div className="h-12 border-b border-pt-line/70 px-3 flex items-center justify-between bg-white">
                    <div className="min-w-0">
                      <div className="pt-eyebrow truncate">{col.title}</div>
                      {col.subtitle && <div className="text-[11px] text-pt-muted truncate">{col.subtitle}</div>}
                    </div>
                    <span className="text-[11px] text-pt-muted shrink-0">
                      {colAppts.filter((a) => !["cancelled", "no_show"].includes(ptLifecycle(a))).length}
                    </span>
                  </div>

                  <div className="relative" style={{ height: (END_HOUR - START_HOUR + 1) * 60 * PX_PER_MIN }}>
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => { setPresetDate(bookDate); setBookOpen(true); }}
                        className="absolute left-0 right-0 border-b border-pt-line/30 hover:bg-pt-beige/30"
                        style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        aria-label={`Book ${bookDate} at ${h}:00`}
                      />
                    ))}

                    {colAppts.map((a) => {
                      const p = people[a.user_id];
                      const life = ptLifecycle(a);
                      const style = PT_LIFECYCLE_STYLE[life];
                      const loc = a.location_id ? locationMap[a.location_id] : undefined;
                      const st = a.session_type_id ? sessionTypeMap[a.session_type_id] : undefined;
                      const tall = a.duration_minutes >= 45;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className={`absolute left-1 right-1 rounded-lg pl-2.5 pr-2 py-1.5 text-left overflow-hidden border shadow-sm transition hover:shadow-md ${style.card}`}
                          style={{ top: offsetFor(a.starts_at), height: Math.max(a.duration_minutes * PX_PER_MIN - 4, 36) }}
                        >
                          <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${style.bar}`} />
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[12px] font-medium truncate">{p?.name ?? "Client"}</span>
                            <span className="text-[10px] text-pt-muted shrink-0">
                              {fmtDate(parseISO(a.starts_at), "h:mm")}
                            </span>
                          </div>
                          <div className="text-[10px] text-pt-muted truncate">
                            {st?.name ?? PT_FORMAT_LABEL[a.format]}
                            {a.instructor_id ? ` · ${trainerMap[a.instructor_id] ?? ""}` : " · Unassigned"}
                          </div>
                          {tall && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <PTBadge tone={style.badge}>{PT_LIFECYCLE_LABEL[life]}</PTBadge>
                              {loc && <PTBadge><MapPin className="h-3 w-3" />{loc.name}</PTBadge>}
                              {a.payment_status === "unpaid" && (
                                <span className="text-[10px] text-pt-red">{formatCents(a.amount_due_cents ?? 0)}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!isLoading && appts.length === 0 && (
          <div className="p-6"><PTEmpty>No sessions match these filters.</PTEmpty></div>
        )}
      </PTCard>

      <PTAppointmentDrawer
        appointment={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        presetDate={presetDate}
        onBooked={() => qc.invalidateQueries({ queryKey: ["pt-appointments"] })}
      />
    </PTShell>
  );
}
