import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format as fmtDate, parseISO, differenceInCalendarDays } from "date-fns";
import {
  ArrowLeft, Mail, Phone, Plus, CalendarPlus, ClipboardList, LineChart, UserCog,
  ShieldAlert, Camera, FileText, MessageSquare, History, Lock, ChevronDown, ChevronRight,
} from "lucide-react";
import { formatCents, PT_FORMAT_LABEL } from "@/lib/ptFormat";
import {
  PTShell, PTCard, PTStatus, PTBadge, PTTable, PTEmptyState, PTTabs, PTModal, PTAlert,
  PTTimeline, PTSectionTitle, ptButtonClass, PTDropdown,
} from "@/components/admin/pt/PTUI";
import { usePTTrainers, usePTTrainerMap, usePTClientProfile, useSavePTClientProfile } from "@/hooks/pt/usePTPortal";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import {
  usePTClientAppointments, usePTClientPassesFull, usePTClientSessionNotes, usePTClientMetrics,
  usePTClientPhotos, usePTClientDocuments, usePTClientPrograms, usePTClientPrs, usePTClientMilestones,
  usePTClientTests, usePTClientActivity, usePTClientCommunications, usePTClientAudit,
  usePTClientAlerts, usePTAlertMutations, usePTClientActions,
} from "@/hooks/pt/usePTClientRecord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";

const TABS = [
  "Overview", "Sessions", "Programs", "Progress", "Notes",
  "Documents", "Billing", "Communication", "Check-Ins", "History",
] as const;
type Tab = typeof TABS[number];

const fmt = (v?: string | null, p = "MMM d, yyyy") => (v ? fmtDate(parseISO(v), p) : "—");
const dt = (v?: string | null) => (v ? fmtDate(parseISO(v), "MMM d, yyyy · h:mm a") : "—");
const listOf = (v: any): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? [v] : [];

/* ------------------------------------------------------------ collapsible */

function Collapsible({ title, children, defaultOpen = false, meta }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; meta?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-pt-line/70 first:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 py-2.5 text-left">
        <span className="flex items-center gap-2 text-[13px] font-medium text-pt-ink">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-pt-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-pt-muted" />}
          {title}
        </span>
        {meta}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="pt-eyebrow">{label}</div>
      <div className="text-[13px] text-pt-ink mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function PTClientDetail() {
  const { userId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("Overview");
  const [bookOpen, setBookOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const { data: directory = [] } = usePTClientDirectory();
  const row = useMemo(() => directory.find((r) => r.userId === userId), [directory, userId]);
  const { data: profile } = usePTClientProfile(userId);
  const saveProfile = useSavePTClientProfile(userId);
  const { data: trainers = [] } = usePTTrainers();
  const trainerMap = usePTTrainerMap();

  const { data: appts = [] } = usePTClientAppointments(userId);
  const { data: passes = [] } = usePTClientPassesFull(userId);
  const { data: notes = [] } = usePTClientSessionNotes(userId);
  const { data: metrics = [] } = usePTClientMetrics(userId);
  const { data: photos = [] } = usePTClientPhotos(userId);
  const { data: documents = [] } = usePTClientDocuments(userId);
  const { data: programs = [] } = usePTClientPrograms(userId);
  const { data: prs = [] } = usePTClientPrs(userId);
  const { data: milestones = [] } = usePTClientMilestones(userId);
  const { data: tests = [] } = usePTClientTests(userId);
  const { data: activity = [] } = usePTClientActivity(userId);
  const { data: comms = [] } = usePTClientCommunications(userId);
  const { data: audit = [] } = usePTClientAudit(userId);
  const { data: alerts = [] } = usePTClientAlerts(userId);

  const alertMut = usePTAlertMutations(userId);
  const actions = usePTClientActions(userId);

  const nowIso = new Date().toISOString();
  const upcoming = appts.filter((a: any) => a.starts_at >= nowIso && !["cancelled", "late_cancel", "no_show"].includes(a.status));
  const past = appts.filter((a: any) => a.starts_at < nowIso).slice().reverse();
  const openAlerts = alerts.filter((a) => !a.is_resolved);
  const resolvedAlerts = alerts.filter((a) => a.is_resolved);
  const name = row?.name ?? profile?.full_name ?? "Client";

  return (
    <PTShell>
      <Link to="/admin/pt/clients" className="inline-flex items-center gap-1.5 text-[13px] text-pt-muted hover:text-pt-ink mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      {/* ---------------------------------------------------------- header */}
      <PTCard className="mb-4">
        <div className="flex flex-wrap items-start gap-4">
          {row?.photoUrl ? (
            <img src={row.photoUrl} alt={`${name} headshot`} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-full grid place-items-center bg-pt-beige text-lg font-medium text-pt-ink">
              {row?.initials ?? name.slice(0, 1)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="pt-serif text-3xl leading-tight text-pt-ink">{name}</h1>
              <PTStatus status={row?.clientStatus ?? profile?.status ?? "active"} />
              {row?.isMember
                ? <PTBadge tone="green">Member · {row.membershipStatus}</PTBadge>
                : <PTBadge>Non-member</PTBadge>}
              {(profile?.tags ?? []).map((t: string) => <PTBadge key={t} tone="gold">{t}</PTBadge>)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-pt-muted mt-1.5">
              {row?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{row.email}</span>}
              {row?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{row.phone}</span>}
              <span>Client since {fmt(row?.memberSince)}</span>
              <span>Trainer: {row?.primaryTrainerId ? trainerMap[row.primaryTrainerId] ?? "—" : "Unassigned"}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <Field label="Package" value={row?.activePackName ?? "None"} />
              <Field label="Sessions left" value={<span className={(row?.sessionsRemaining ?? 0) <= 2 ? "text-pt-amber font-medium" : ""}>{row?.sessionsRemaining ?? 0}</span>} />
              <Field label="Next session" value={row?.nextAppointment ? dt(row.nextAppointment) : "Not booked"} />
              <Field label="Attendance" value={row?.attendanceRate === null || row?.attendanceRate === undefined ? "—" : `${row.attendanceRate}%`} />
              <Field label="Last visit" value={fmt(row?.lastVisit)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className={ptButtonClass("outline")} onClick={() => setMessageOpen(true)}><MessageSquare className="h-4 w-4 mr-1.5" />Message</button>
            <a className={ptButtonClass("outline")} href={row?.phone ? `tel:${row.phone}` : undefined} aria-disabled={!row?.phone}><Phone className="h-4 w-4 mr-1.5" />Call</a>
            <button className={ptButtonClass("primary")} onClick={() => setBookOpen(true)}><CalendarPlus className="h-4 w-4 mr-1.5" />Book session</button>
            <PTDropdown
              label="More actions"
              trigger={<button className={ptButtonClass("ghost")}>More</button>}
              items={[
                { label: "Add note", icon: ClipboardList, onSelect: () => setNoteOpen(true) },
                { label: "Progress check-in", icon: LineChart, onSelect: () => setCheckInOpen(true) },
                { label: "Assign trainer", icon: UserCog, onSelect: () => setTrainerOpen(true) },
                { label: "Update status", icon: ShieldAlert, onSelect: () => setStatusOpen(true) },
                { label: "Raise alert", icon: ShieldAlert, onSelect: () => setAlertOpen(true), separatorBefore: true },
                { label: "Add document", icon: FileText, onSelect: () => setDocOpen(true) },
                { label: "Sell package", icon: Plus, onSelect: () => setSellOpen(true) },
              ]}
            />
          </div>
        </div>
      </PTCard>

      {openAlerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {openAlerts.slice(0, 3).map((a) => (
            <PTAlert
              key={a.id}
              tone={a.severity === "high" || a.severity === "urgent" ? "danger" : a.severity === "medium" ? "warning" : "info"}
              title={`${a.alert_type?.replace(/_/g, " ") ?? "Alert"}${a.due_date ? ` · due ${fmt(a.due_date)}` : ""}`}
              action={<button className={ptButtonClass("ghost")} onClick={() => alertMut.resolve.mutate({ id: a.id })}>Resolve</button>}
            >
              {a.message}
            </PTAlert>
          ))}
        </div>
      )}

      <PTTabs<Tab>
        tabs={TABS.map((t) => ({
          value: t,
          label: t,
          count: t === "Sessions" ? appts.length : t === "Notes" ? notes.length
            : t === "Documents" ? documents.length : t === "Programs" ? programs.length
            : t === "Communication" ? comms.length : undefined,
        }))}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {/* -------------------------------------------------------- overview */}
      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <PTCard>
              <PTSectionTitle>Client snapshot</PTSectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Date of birth" value={fmt(profile?.date_of_birth)} />
                <Field label="Height" value={profile?.height ?? (profile?.height_inches ? `${profile.height_inches} in` : "—")} />
                <Field label="PAR-Q" value={profile?.parq_status ? <PTStatus status={profile.parq_status} /> : "Not on file"} />
                <Field label="Emergency contact" value={profile?.emergency_contact_name
                  ? `${profile.emergency_contact_name}${profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ""}`
                  : "—"} />
              </div>
            </PTCard>

            <PTCard>
              <PTSectionTitle>Goals & focus areas</PTSectionTitle>
              {listOf(profile?.goals).length
                ? <ul className="space-y-1.5">{listOf(profile?.goals).map((g, i) => (
                    <li key={i} className="text-[13px] text-pt-ink flex gap-2"><span className="text-pt-gold">•</span>{g}</li>))}
                  </ul>
                : <p className="text-[13px] text-pt-muted">No goals recorded yet.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle action={<button className={ptButtonClass("ghost")} onClick={() => setAlertOpen(true)}>Add alert</button>}>
                Training alerts & restrictions
              </PTSectionTitle>
              {listOf(profile?.restrictions).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {listOf(profile?.restrictions).map((r, i) => <PTBadge key={i} tone="red">{r}</PTBadge>)}
                </div>
              )}
              {profile?.medical_notes && <p className="text-[13px] text-pt-muted mb-3">{profile.medical_notes}</p>}
              <PTTable
                dense
                rows={openAlerts}
                getRowKey={(a) => a.id}
                empty={<p className="text-[13px] text-pt-muted py-2">No open alerts.</p>}
                columns={[
                  { key: "sev", header: "Severity", render: (a) => <PTBadge tone={a.severity === "high" || a.severity === "urgent" ? "red" : a.severity === "medium" ? "amber" : "neutral"}>{a.severity}</PTBadge> },
                  { key: "msg", header: "Alert", render: (a) => <span>{a.message}</span> },
                  { key: "due", header: "Due", render: (a) => fmt(a.due_date) },
                  { key: "who", header: "Assigned", render: (a) => (a.assigned_to && trainerMap[a.assigned_to]) || "—" },
                  { key: "act", header: "", align: "right", render: (a) => <button className={ptButtonClass("ghost")} onClick={() => alertMut.resolve.mutate({ id: a.id })}>Resolve</button> },
                ]}
              />
              {resolvedAlerts.length > 0 && (
                <Collapsible title={`Alert history (${resolvedAlerts.length})`}>
                  <ul className="space-y-1.5">
                    {resolvedAlerts.map((a) => (
                      <li key={a.id} className="text-xs text-pt-muted">
                        {fmt(a.resolved_at)} — {a.message}
                        {a.resolution_notes ? ` · ${a.resolution_notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </Collapsible>
              )}
            </PTCard>

            <PTCard>
              <PTSectionTitle action={<button className={ptButtonClass("ghost")} onClick={() => setCheckInOpen(true)}>New check-in</button>}>
                Body metrics summary
              </PTSectionTitle>
              {metrics.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Weight" value={metrics[0].weight_lbs ? `${metrics[0].weight_lbs} lb` : "—"} />
                  <Field label="Body fat" value={metrics[0].body_fat_pct ? `${metrics[0].body_fat_pct}%` : "—"} />
                  <Field label="Waist" value={metrics[0].waist_in ? `${metrics[0].waist_in} in` : "—"} />
                  <Field label="Measured" value={fmt(metrics[0].measured_on)} />
                </div>
              ) : <p className="text-[13px] text-pt-muted">No measurements recorded.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Progress photos</PTSectionTitle>
              {photos.length ? (
                <div className="flex gap-2 overflow-x-auto pt-scroll">
                  {photos.slice(0, 8).map((p: any) => (
                    <div key={p.id} className="shrink-0 w-24">
                      <div className="h-28 w-24 rounded-lg bg-pt-beige grid place-items-center text-pt-muted">
                        <Camera className="h-4 w-4" />
                      </div>
                      <div className="text-[11px] text-pt-muted mt-1">{fmt(p.taken_on, "MMM d")}{p.pose ? ` · ${p.pose}` : ""}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[13px] text-pt-muted">No photos on file.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle action={<PTBadge tone="noir"><Lock className="h-3 w-3" /> Staff only</PTBadge>}>
                Internal trainer notes
              </PTSectionTitle>
              <Textarea
                defaultValue={profile?.internal_notes ?? ""}
                placeholder="Visible to trainers and admins only — never shown to the client."
                className="bg-white border-pt-line min-h-24"
                onBlur={(e) => {
                  if (e.target.value !== (profile?.internal_notes ?? "")) {
                    saveProfile.mutate({ internal_notes: e.target.value });
                  }
                }}
              />
            </PTCard>
          </div>

          <div className="space-y-4">
            <PTCard>
              <PTSectionTitle>Upcoming appointments</PTSectionTitle>
              <PTTimeline
                empty={<p className="text-[13px] text-pt-muted">Nothing booked.</p>}
                items={upcoming.slice(0, 5).map((a: any) => ({
                  id: a.id,
                  title: a.session_type_name ?? PT_FORMAT_LABEL[a.format] ?? "Session",
                  description: a.instructor_id ? trainerMap[a.instructor_id] : undefined,
                  time: fmtDate(parseISO(a.starts_at), "MMM d, h:mm a"),
                  meta: a.status,
                  tone: "gold" as const,
                }))}
              />
            </PTCard>

            <PTCard>
              <PTSectionTitle>Package summary</PTSectionTitle>
              {passes.length ? (
                <ul className="space-y-2">
                  {passes.slice(0, 4).map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[13px] text-pt-ink truncate">{p.pack_name}</span>
                        <span className="block text-xs text-pt-muted">exp {fmt(p.expires_at)}</span>
                      </span>
                      <span className="text-right">
                        <PTStatus status={p.status} />
                        <span className="block text-xs text-pt-muted mt-0.5">{p.sessions_remaining}/{p.sessions_total}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-pt-muted">No packages purchased.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Attendance summary</PTSectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rate" value={row?.attendanceRate === null || row?.attendanceRate === undefined ? "—" : `${row.attendanceRate}%`} />
                <Field label="Sessions counted" value={row?.attendanceCounted ?? 0} />
                <Field label="No-shows" value={row?.noShows ?? 0} />
                <Field label="Balance due" value={formatCents(row?.owedCents ?? 0)} />
              </div>
            </PTCard>

            <PTCard>
              <PTSectionTitle>Session preferences</PTSectionTitle>
              {listOf(profile?.training_preferences).length || listOf(profile?.preferences).length ? (
                <div className="flex flex-wrap gap-1.5">
                  {[...listOf(profile?.training_preferences), ...listOf(profile?.preferences)].map((p, i) => <PTBadge key={i}>{p}</PTBadge>)}
                </div>
              ) : <p className="text-[13px] text-pt-muted">No preferences recorded.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Recent session notes</PTSectionTitle>
              {notes.length ? (
                <ul className="space-y-2">
                  {notes.slice(0, 3).map((n: any) => (
                    <li key={n.id}>
                      <div className="text-[13px] text-pt-ink">{fmt(n.session_date)}</div>
                      <div className="text-xs text-pt-muted line-clamp-2">{n.subjective || n.objective || n.observations || "—"}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-pt-muted">No notes yet.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Forms & expirations</PTSectionTitle>
              {documents.length ? (
                <ul className="space-y-2">
                  {documents.slice(0, 5).map((d: any) => {
                    const days = d.expires_at ? differenceInCalendarDays(parseISO(d.expires_at), new Date()) : null;
                    return (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-pt-ink truncate">{d.title}</span>
                        {days === null ? <PTStatus status={d.status ?? "complete"} />
                          : <PTBadge tone={days < 0 ? "red" : days < 30 ? "amber" : "green"}>{days < 0 ? "Expired" : `${days}d`}</PTBadge>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-[13px] text-pt-muted">No forms on file.</p>}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Visit history</PTSectionTitle>
              <PTTimeline
                empty={<p className="text-[13px] text-pt-muted">No visits yet.</p>}
                items={past.slice(0, 6).map((a: any) => ({
                  id: a.id,
                  title: a.session_type_name ?? PT_FORMAT_LABEL[a.format] ?? "Session",
                  description: a.instructor_id ? trainerMap[a.instructor_id] : undefined,
                  time: fmtDate(parseISO(a.starts_at), "MMM d"),
                  meta: a.status,
                  tone:
                    a.status === "no_show"
                      ? ("red" as const)
                      : a.status === "completed"
                        ? ("green" as const)
                        : ("default" as const),
                }))}
              />
            </PTCard>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- sessions */}
      {tab === "Sessions" && (
        <PTCard padded={false}>
          <PTTable
            rows={appts}
            getRowKey={(a: any) => a.id}
            empty={<PTEmptyState icon={CalendarPlus} title="No sessions yet" action={<button className={ptButtonClass("primary")} onClick={() => setBookOpen(true)}>Book session</button>} />}
            columns={[
              { key: "when", header: "When", render: (a: any) => dt(a.starts_at) },
              { key: "type", header: "Type", render: (a: any) => a.session_type_name ?? PT_FORMAT_LABEL[a.format] ?? "—" },
              { key: "trainer", header: "Trainer", render: (a: any) => (a.instructor_id && trainerMap[a.instructor_id]) || "—" },
              { key: "status", header: "Status", render: (a: any) => <PTStatus status={a.status} /> },
              { key: "pay", header: "Payment", render: (a: any) => <PTStatus status={a.payment_status ?? "pass"} /> },
              { key: "due", header: "Amount", align: "right", render: (a: any) => a.amount_due_cents ? formatCents(a.amount_due_cents) : "—" },
            ]}
          />
        </PTCard>
      )}

      {/* -------------------------------------------------------- programs */}
      {tab === "Programs" && (
        <PTCard padded={false}>
          <PTTable
            rows={programs}
            getRowKey={(p: any) => p.id}
            empty={<PTEmptyState icon={ClipboardList} title="No programs assigned" />}
            columns={[
              { key: "name", header: "Program", render: (p: any) => p.name ?? p.title ?? "Program" },
              { key: "status", header: "Status", render: (p: any) => <PTStatus status={p.status ?? "active"} /> },
              { key: "start", header: "Start", render: (p: any) => fmt(p.start_date) },
              { key: "reassess", header: "Reassessment", render: (p: any) => fmt(p.next_reassessment) },
              { key: "notes", header: "Notes", render: (p: any) => <span className="text-pt-muted">{p.notes ?? "—"}</span> },
            ]}
          />
        </PTCard>
      )}

      {/* -------------------------------------------------------- progress */}
      {tab === "Progress" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle action={<button className={ptButtonClass("ghost")} onClick={() => setCheckInOpen(true)}>Add check-in</button>}>Body metrics</PTSectionTitle></div>
            <PTTable
              rows={metrics}
              getRowKey={(m: any) => m.id}
              empty={<p className="text-[13px] text-pt-muted p-4">No measurements.</p>}
              columns={[
                { key: "d", header: "Date", render: (m: any) => fmt(m.measured_on) },
                { key: "w", header: "Weight", align: "right", render: (m: any) => m.weight_lbs ?? "—" },
                { key: "bf", header: "Body fat", align: "right", render: (m: any) => m.body_fat_pct ?? "—" },
                { key: "waist", header: "Waist", align: "right", render: (m: any) => m.waist_in ?? "—" },
              ]}
            />
          </PTCard>
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Personal records</PTSectionTitle></div>
            <PTTable
              rows={prs}
              getRowKey={(p: any) => p.id}
              empty={<p className="text-[13px] text-pt-muted p-4">No PRs logged.</p>}
              columns={[
                { key: "e", header: "Exercise", render: (p: any) => p.exercise ?? p.name ?? "—" },
                { key: "v", header: "Result", align: "right", render: (p: any) => `${p.value ?? p.weight_lbs ?? "—"}${p.unit ? ` ${p.unit}` : ""}` },
                { key: "d", header: "Date", render: (p: any) => fmt(p.achieved_on) },
              ]}
            />
          </PTCard>
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Performance tests</PTSectionTitle></div>
            <PTTable
              rows={tests}
              getRowKey={(t: any) => t.id}
              empty={<p className="text-[13px] text-pt-muted p-4">No tests recorded.</p>}
              columns={[
                { key: "n", header: "Test", render: (t: any) => t.test_name ?? t.name ?? "—" },
                { key: "r", header: "Result", align: "right", render: (t: any) => t.result ?? t.value ?? "—" },
                { key: "d", header: "Date", render: (t: any) => fmt(t.tested_on) },
              ]}
            />
          </PTCard>
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Milestones</PTSectionTitle></div>
            <PTTable
              rows={milestones}
              getRowKey={(m: any) => m.id}
              empty={<p className="text-[13px] text-pt-muted p-4">No milestones.</p>}
              columns={[
                { key: "t", header: "Milestone", render: (m: any) => m.title ?? m.name ?? "—" },
                { key: "s", header: "Status", render: (m: any) => <PTStatus status={m.status ?? "in_progress"} /> },
                { key: "d", header: "Target", render: (m: any) => fmt(m.target_date) },
              ]}
            />
          </PTCard>
        </div>
      )}

      {/* ----------------------------------------------------------- notes */}
      {tab === "Notes" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className={ptButtonClass("primary")} onClick={() => setNoteOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add note</button>
          </div>
          {notes.length === 0 && <PTEmptyState icon={ClipboardList} title="No session notes yet" />}
          {notes.map((n: any) => (
            <PTCard key={n.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[13px] font-medium text-pt-ink">{fmt(n.session_date)}</div>
                <div className="flex items-center gap-2">
                  {n.rpe && <PTBadge>RPE {n.rpe}</PTBadge>}
                  {n.is_draft && <PTBadge tone="amber">Draft</PTBadge>}
                </div>
              </div>
              {n.subjective && <p className="text-[13px] text-pt-ink mb-1"><span className="pt-eyebrow mr-2">Subjective</span>{n.subjective}</p>}
              {n.objective && <p className="text-[13px] text-pt-ink mb-1"><span className="pt-eyebrow mr-2">Objective</span>{n.objective}</p>}
              {n.next_focus && <p className="text-[13px] text-pt-muted">Next focus: {n.next_focus}</p>}
              {n.private_note && (
                <Collapsible title="Internal note (staff only)" meta={<PTBadge tone="noir"><Lock className="h-3 w-3" /> Private</PTBadge>}>
                  <p className="text-[13px] text-pt-muted">{n.private_note}</p>
                </Collapsible>
              )}
            </PTCard>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- documents */}
      {tab === "Documents" && (
        <PTCard padded={false}>
          <div className="p-4 pb-0 flex justify-end">
            <button className={ptButtonClass("outline")} onClick={() => setDocOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add document</button>
          </div>
          <PTTable
            rows={documents}
            getRowKey={(d: any) => d.id}
            empty={<PTEmptyState icon={FileText} title="No documents" />}
            columns={[
              { key: "t", header: "Title", render: (d: any) => d.external_url ? <a href={d.external_url} target="_blank" rel="noreferrer" className="text-pt-gold hover:underline">{d.title}</a> : d.title },
              { key: "ty", header: "Type", render: (d: any) => <span className="capitalize">{String(d.doc_type ?? "").replace(/_/g, " ")}</span> },
              { key: "s", header: "Status", render: (d: any) => <PTStatus status={d.status ?? "complete"} /> },
              { key: "e", header: "Expires", render: (d: any) => fmt(d.expires_at) },
              { key: "c", header: "Added", render: (d: any) => fmt(d.created_at) },
            ]}
          />
        </PTCard>
      )}

      {/* --------------------------------------------------------- billing */}
      {tab === "Billing" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle action={<button className={ptButtonClass("ghost")} onClick={() => setSellOpen(true)}>Sell package</button>}>Packages</PTSectionTitle></div>
            <PTTable
              rows={passes}
              getRowKey={(p: any) => p.id}
              empty={<p className="text-[13px] text-pt-muted p-4">No packages.</p>}
              columns={[
                { key: "n", header: "Package", render: (p: any) => p.pack_name },
                { key: "s", header: "Status", render: (p: any) => <PTStatus status={p.status} /> },
                { key: "r", header: "Remaining", align: "right", render: (p: any) => `${p.sessions_remaining}/${p.sessions_total}` },
                { key: "e", header: "Expires", render: (p: any) => fmt(p.expires_at) },
              ]}
            />
          </PTCard>
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Unpaid sessions</PTSectionTitle></div>
            <PTTable
              rows={appts.filter((a: any) => a.payment_status === "unpaid")}
              getRowKey={(a: any) => a.id}
              empty={<p className="text-[13px] text-pt-muted p-4">Nothing outstanding.</p>}
              columns={[
                { key: "d", header: "Session", render: (a: any) => dt(a.starts_at) },
                { key: "amt", header: "Owed", align: "right", render: (a: any) => formatCents(a.amount_due_cents ?? 0) },
              ]}
            />
          </PTCard>
        </div>
      )}

      {/* --------------------------------------------------- communication */}
      {tab === "Communication" && (
        <PTCard padded={false}>
          <div className="p-4 pb-0 flex justify-end">
            <button className={ptButtonClass("outline")} onClick={() => setMessageOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Log message</button>
          </div>
          <PTTable
            rows={comms}
            getRowKey={(c: any) => c.id}
            empty={<PTEmptyState icon={MessageSquare} title="No communication logged" />}
            columns={[
              { key: "d", header: "When", render: (c: any) => dt(c.sent_at ?? c.created_at) },
              { key: "ch", header: "Channel", render: (c: any) => <PTBadge>{c.channel}</PTBadge> },
              { key: "dir", header: "Direction", render: (c: any) => c.direction },
              { key: "s", header: "Subject", render: (c: any) => c.subject ?? "—" },
              { key: "b", header: "Message", render: (c: any) => <span className="text-pt-muted line-clamp-2">{c.body}</span> },
            ]}
          />
        </PTCard>
      )}

      {/* -------------------------------------------------------- check-ins */}
      {tab === "Check-Ins" && (
        <PTCard padded={false}>
          <div className="p-4 pb-0 flex justify-end">
            <button className={ptButtonClass("primary")} onClick={() => setCheckInOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Progress check-in</button>
          </div>
          <PTTable
            rows={metrics}
            getRowKey={(m: any) => m.id}
            empty={<PTEmptyState icon={LineChart} title="No check-ins recorded" />}
            columns={[
              { key: "d", header: "Date", render: (m: any) => fmt(m.measured_on) },
              { key: "w", header: "Weight", align: "right", render: (m: any) => m.weight_lbs ?? "—" },
              { key: "bf", header: "Body fat %", align: "right", render: (m: any) => m.body_fat_pct ?? "—" },
              { key: "waist", header: "Waist", align: "right", render: (m: any) => m.waist_in ?? "—" },
              { key: "n", header: "Notes", render: (m: any) => <span className="text-pt-muted">{m.notes ?? "—"}</span> },
            ]}
          />
        </PTCard>
      )}

      {/* --------------------------------------------------------- history */}
      {tab === "History" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PTCard>
            <PTSectionTitle>Client activity</PTSectionTitle>
            <PTTimeline
              empty={<p className="text-[13px] text-pt-muted">No activity yet.</p>}
              items={activity.slice(0, 40).map((a: any) => ({
                id: a.id,
                title: String(a.action ?? "").replace(/_/g, " "),
                description: a.detail,
                time: fmtDate(parseISO(a.created_at), "MMM d, h:mm a"),
              }))}
            />
          </PTCard>
          <PTCard>
            <PTSectionTitle action={<PTBadge tone="noir"><History className="h-3 w-3" /> Audit</PTBadge>}>Record changes</PTSectionTitle>
            <PTTimeline
              empty={<p className="text-[13px] text-pt-muted">No changes recorded.</p>}
              items={audit.slice(0, 40).map((a: any) => ({
                id: a.id,
                title: `${a.action ?? "update"} · ${a.entity_type ?? ""}`,
                description: a.summary ?? a.detail ?? undefined,
                time: fmtDate(parseISO(a.created_at), "MMM d, h:mm a"),
              }))}
            />
          </PTCard>
        </div>
      )}

      {/* --------------------------------------------------------- dialogs */}
      <BookPTSessionDialog open={bookOpen} onOpenChange={setBookOpen} />
      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />

      <AddNoteModal open={noteOpen} onOpenChange={setNoteOpen} onSave={(v) => actions.addSessionNote.mutate(v, { onSuccess: () => setNoteOpen(false) })} />
      <CheckInModal open={checkInOpen} onOpenChange={setCheckInOpen} onSave={(v) => actions.addMetrics.mutate(v, { onSuccess: () => setCheckInOpen(false) })} />
      <MessageModal open={messageOpen} onOpenChange={setMessageOpen} onSave={(v) => actions.logCommunication.mutate(v, { onSuccess: () => setMessageOpen(false) })} />
      <DocumentModal open={docOpen} onOpenChange={setDocOpen} onSave={(v) => actions.addDocument.mutate(v, { onSuccess: () => setDocOpen(false) })} />
      <AlertModal
        open={alertOpen} onOpenChange={setAlertOpen}
        trainers={trainers}
        onSave={(v) => alertMut.create.mutate(v, { onSuccess: () => setAlertOpen(false) })}
      />
      <AssignTrainerModal
        open={trainerOpen} onOpenChange={setTrainerOpen}
        trainers={trainers} current={row?.primaryTrainerId ?? null}
        onSave={(id) => actions.assignTrainer.mutate(id, { onSuccess: () => setTrainerOpen(false) })}
      />
      <StatusModal
        open={statusOpen} onOpenChange={setStatusOpen} current={row?.clientStatus ?? "active"}
        onSave={(s) => actions.updateStatus.mutate(s, { onSuccess: () => setStatusOpen(false) })}
      />
    </PTShell>
  );
}

/* ------------------------------------------------------------- modals */

function AddNoteModal({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: any) => void }) {
  const [form, setForm] = useState({ session_date: new Date().toISOString().slice(0, 10), subjective: "", objective: "", next_focus: "", private_note: "" });
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Add session note"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} onClick={() => onSave(form)}>Save note</button>
      </>}>
      <div className="space-y-3">
        <div><Label className="pt-eyebrow">Date</Label><Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Subjective</Label><Textarea value={form.subjective} onChange={(e) => setForm({ ...form, subjective: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Objective</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Next focus</Label><Input value={form.next_focus} onChange={(e) => setForm({ ...form, next_focus: e.target.value })} className="bg-white border-pt-line" /></div>
        <div>
          <Label className="pt-eyebrow">Internal note (staff only)</Label>
          <Textarea value={form.private_note} onChange={(e) => setForm({ ...form, private_note: e.target.value })} className="bg-white border-pt-line" />
        </div>
      </div>
    </PTModal>
  );
}

function CheckInModal({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: any) => void }) {
  const [form, setForm] = useState<any>({ measured_on: new Date().toISOString().slice(0, 10), weight_lbs: "", body_fat_pct: "", waist_in: "", notes: "" });
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Progress check-in"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} onClick={() => onSave({
          measured_on: form.measured_on, notes: form.notes || null,
          weight_lbs: num(form.weight_lbs), body_fat_pct: num(form.body_fat_pct), waist_in: num(form.waist_in),
        })}>Save check-in</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="pt-eyebrow">Date</Label><Input type="date" value={form.measured_on} onChange={(e) => setForm({ ...form, measured_on: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Weight (lb)</Label><Input value={form.weight_lbs} onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Body fat %</Label><Input value={form.body_fat_pct} onChange={(e) => setForm({ ...form, body_fat_pct: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Waist (in)</Label><Input value={form.waist_in} onChange={(e) => setForm({ ...form, waist_in: e.target.value })} className="bg-white border-pt-line" /></div>
        <div className="col-span-2"><Label className="pt-eyebrow">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white border-pt-line" /></div>
      </div>
    </PTModal>
  );
}

function MessageModal({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: any) => void }) {
  const [form, setForm] = useState({ channel: "email", subject: "", body: "" });
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Log message" description="Record an email, text or call for this client."
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.body.trim()} onClick={() => onSave(form)}>Save</button>
      </>}>
      <div className="space-y-3">
        <div>
          <Label className="pt-eyebrow">Channel</Label>
          <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              {["email", "sms", "call", "in_person"].map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="pt-eyebrow">Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Message</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="bg-white border-pt-line min-h-28" /></div>
      </div>
    </PTModal>
  );
}

function DocumentModal({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: any) => void }) {
  const [form, setForm] = useState({ doc_type: "waiver", title: "", external_url: "", expires_at: "" });
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Add document"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.title.trim()}
          onClick={() => onSave({ ...form, external_url: form.external_url || null, expires_at: form.expires_at || null })}>Save</button>
      </>}>
      <div className="space-y-3">
        <div>
          <Label className="pt-eyebrow">Type</Label>
          <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              {["waiver", "parq", "medical_clearance", "agreement", "other"].map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="pt-eyebrow">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Link</Label><Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://" className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Expires</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="bg-white border-pt-line" /></div>
      </div>
    </PTModal>
  );
}

function AlertModal({ open, onOpenChange, onSave, trainers }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSave: (v: any) => void; trainers: any[];
}) {
  const [form, setForm] = useState({ alert_type: "attendance", severity: "medium", message: "", due_date: "", assigned_to: "" });
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Raise alert"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.message.trim()}
          onClick={() => onSave({ ...form, due_date: form.due_date || null, assigned_to: form.assigned_to || null })}>Create alert</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="pt-eyebrow">Type</Label>
          <Select value={form.alert_type} onValueChange={(v) => setForm({ ...form, alert_type: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              {["attendance", "medical", "payment", "package", "reassessment", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="pt-eyebrow">Severity</Label>
          <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              {["low", "medium", "high", "urgent"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label className="pt-eyebrow">Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="bg-white border-pt-line" /></div>
        <div>
          <Label className="pt-eyebrow">Assign to</Label>
          <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue placeholder="Me" /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              {trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </PTModal>
  );
}

function AssignTrainerModal({ open, onOpenChange, trainers, current, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; trainers: any[]; current: string | null; onSave: (id: string | null) => void;
}) {
  const [value, setValue] = useState(current ?? "none");
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Assign primary trainer"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} onClick={() => onSave(value === "none" ? null : value)}>Save</button>
      </>}>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-white border-pt-line z-50">
          <SelectItem value="none">Unassigned</SelectItem>
          {trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </PTModal>
  );
}

function StatusModal({ open, onOpenChange, current, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; current: string; onSave: (s: string) => void;
}) {
  const [value, setValue] = useState(current);
  return (
    <PTModal open={open} onOpenChange={onOpenChange} title="Update client status"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} onClick={() => onSave(value)}>Save</button>
      </>}>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-white border-pt-line z-50">
          {["prospect", "active", "paused", "inactive", "archived"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </PTModal>
  );
}
