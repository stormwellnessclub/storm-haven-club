import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format as fmtDate } from "date-fns";
import { Users, CalendarClock, Download, X } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTSectionTitle, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { usePTTrainerProfiles, usePTTrainerDetail, PTTrainerProfile } from "@/hooks/pt/usePTTrainerProfiles";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { downloadCsv } from "@/lib/ptExport";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pct(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

export default function PTTrainers() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PTTrainerProfile | null>(null);
  const { data: trainers = [], isLoading } = usePTTrainerProfiles();

  const activeCount = useMemo(() => trainers.filter((t) => t.is_active).length, [trainers]);

  const columns: PTColumn<PTTrainerProfile>[] = [
    {
      key: "name", header: "Trainer",
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-full border border-pt-line shrink-0" style={{ background: t.schedule_color || "hsl(var(--pt-gold))" }} />
          <div className="min-w-0">
            <div className="text-pt-ink font-medium">{t.name}</div>
            <div className="text-xs text-pt-muted truncate">{t.email || t.phone || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "specialties", header: "Specialties",
      render: (t) => t.specialties.length ? (
        <div className="flex flex-wrap gap-1">
          {t.specialties.slice(0, 3).map((s) => <PTBadge key={s}>{s}</PTBadge>)}
          {t.specialties.length > 3 && <PTBadge>+{t.specialties.length - 3}</PTBadge>}
        </div>
      ) : <span className="text-pt-muted">—</span>,
    },
    { key: "clients", header: "Clients", align: "right", render: (t) => t.assignedClients },
    { key: "upcoming", header: "Upcoming", align: "right", render: (t) => t.upcoming },
    { key: "completed", header: "Completed 90d", align: "right", render: (t) => t.completed90 },
    { key: "attendance", header: "Attendance", align: "right", render: (t) => pct(t.attendanceRate) },
    { key: "notes", header: "Notes done", align: "right", render: (t) => <span className={t.notesCompletionRate !== null && t.notesCompletionRate < 80 ? "text-pt-amber" : ""}>{pct(t.notesCompletionRate)}</span> },
    { key: "retention", header: "Retention", align: "right", render: (t) => pct(t.retentionRate) },
    { key: "util", header: "Pkg use", align: "right", render: (t) => pct(t.packageUtilization) },
    {
      key: "status", header: "", align: "right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          {t.is_master && <PTBadge tone="gold">Master</PTBadge>}
          <PTBadge tone={t.is_active ? "green" : "neutral"}>{t.is_active ? "Active" : "Inactive"}</PTBadge>
        </div>
      ),
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Team"
        title="Trainers"
        subtitle={`${activeCount} active on the roster · metrics from the last 90 days.`}
        actions={
          <>
            <button
              className={ptButtonClass("outline")}
              onClick={() => downloadCsv("pt-trainers", trainers.map((t) => ({
                trainer: t.name, email: t.email ?? "", phone: t.phone ?? "", status: t.is_active ? "active" : "inactive",
                employment: t.employment_status ?? "", clients: t.assignedClients, upcoming: t.upcoming,
                completed_90d: t.completed90, no_shows_90d: t.noShows90, cancellations_90d: t.cancels90,
                attendance_rate: t.attendanceRate ?? "", notes_completion_rate: t.notesCompletionRate ?? "",
                retention_rate: t.retentionRate ?? "", package_utilization: t.packageUtilization ?? "",
              })))}
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/personal-training/availability")}>
              <CalendarClock className="h-4 w-4" /> Manage availability
            </button>
          </>
        }
      />
      <PTCard padded={false}>
        <PTTable
          columns={columns}
          rows={trainers}
          loading={isLoading}
          getRowKey={(t) => t.id}
          onRowClick={(t) => setSelected(t)}
          empty={<PTEmptyState icon={Users} title="No trainers yet" description="Add instructors to build the training team." />}
        />
      </PTCard>

      <TrainerSheet trainer={selected} onClose={() => setSelected(null)} />
    </PTShell>
  );
}

function TrainerSheet({ trainer, onClose }: { trainer: PTTrainerProfile | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { availability, locations, upcoming, clients, notes } = usePTTrainerDetail(trainer?.id);
  const clientIds = (clients.data ?? []).map((c: any) => c.client_user_id);
  const apptIds = (upcoming.data ?? []).map((a: any) => a.user_id);
  const { data: people = {} } = usePTPeople([...clientIds, ...apptIds]);

  return (
    <Sheet open={!!trainer} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-pt-cream p-0">
        {trainer && (
          <div className="p-5 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-pt-muted">Trainer profile</div>
                <h2 className="text-2xl font-serif text-pt-ink">{trainer.name}</h2>
                <div className="text-sm text-pt-muted">{trainer.email || "—"} · {trainer.phone || "—"}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <PTBadge tone={trainer.is_active ? "green" : "neutral"}>{trainer.is_active ? "Active" : "Inactive"}</PTBadge>
                  {trainer.employment_status && <PTBadge><span className="capitalize">{trainer.employment_status.replace(/_/g, " ")}</span></PTBadge>}
                  {trainer.is_master && <PTBadge tone="gold">Master</PTBadge>}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close trainer details" className="text-pt-muted hover:text-pt-ink"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Completed 90d", String(trainer.completed90)],
                ["Attendance", pct(trainer.attendanceRate)],
                ["Notes done", pct(trainer.notesCompletionRate)],
                ["Retention", pct(trainer.retentionRate)],
                ["Package use", pct(trainer.packageUtilization)],
                ["Clients", String(trainer.assignedClients)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-pt-line bg-white px-2 py-3">
                  <div className="text-lg font-medium text-pt-ink">{value}</div>
                  <div className="text-[11px] uppercase tracking-wide text-pt-muted">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <PTSectionTitle>Specialties</PTSectionTitle>
              <div className="flex flex-wrap gap-1 mt-2">
                {trainer.specialties.length
                  ? trainer.specialties.map((s) => <PTBadge key={s}>{s}</PTBadge>)
                  : <span className="text-sm text-pt-muted">None recorded</span>}
              </div>
            </div>

            <div>
              <PTSectionTitle>Locations</PTSectionTitle>
              <div className="flex flex-wrap gap-1 mt-2">
                {(locations.data ?? []).length
                  ? (locations.data ?? []).map((l: any) => <PTBadge key={l.id}>{l.name}</PTBadge>)
                  : <span className="text-sm text-pt-muted">No locations assigned</span>}
              </div>
            </div>

            <div>
              <PTSectionTitle>Weekly availability</PTSectionTitle>
              <div className="mt-2 space-y-1 text-sm">
                {(availability.data ?? []).length
                  ? (availability.data ?? []).map((a: any) => (
                      <div key={a.id} className="flex justify-between rounded-md border border-pt-line bg-white px-3 py-1.5">
                        <span>{WEEKDAYS[a.weekday] ?? `Day ${a.weekday}`}</span>
                        <span className="text-pt-muted">{a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}</span>
                      </div>
                    ))
                  : <span className="text-pt-muted">No availability set</span>}
              </div>
            </div>

            <div>
              <PTSectionTitle>Upcoming schedule</PTSectionTitle>
              <div className="mt-2 space-y-1 text-sm">
                {(upcoming.data ?? []).length
                  ? (upcoming.data ?? []).map((a: any) => (
                      <div key={a.id} className="flex justify-between rounded-md border border-pt-line bg-white px-3 py-1.5">
                        <span>{fmtDate(new Date(a.starts_at), "EEE MMM d, h:mm a")}</span>
                        <span className="text-pt-muted">{people[a.user_id]?.name ?? "—"}</span>
                      </div>
                    ))
                  : <span className="text-pt-muted">Nothing booked</span>}
              </div>
            </div>

            <div>
              <PTSectionTitle>Assigned clients</PTSectionTitle>
              <div className="mt-2 space-y-1 text-sm">
                {clientIds.length
                  ? clientIds.map((id: string) => (
                      <button
                        key={id}
                        onClick={() => { onClose(); navigate(`/admin/pt/clients/${id}`); }}
                        className="w-full text-left rounded-md border border-pt-line bg-white px-3 py-1.5 hover:border-pt-gold"
                      >
                        {people[id]?.name ?? "—"}
                      </button>
                    ))
                  : <span className="text-pt-muted">No clients assigned</span>}
              </div>
            </div>

            <div>
              <PTSectionTitle>Notes</PTSectionTitle>
              <div className="mt-2 space-y-1 text-sm">
                {(notes.data ?? []).length
                  ? (notes.data ?? []).map((n: any) => (
                      <div key={n.id} className="rounded-md border border-pt-line bg-white px-3 py-2">
                        <div className="text-[11px] text-pt-muted">{fmtDate(new Date(n.created_at), "MMM d, yyyy")}</div>
                        <div className="whitespace-pre-wrap">{n.body}</div>
                      </div>
                    ))
                  : <span className="text-pt-muted">No notes</span>}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
