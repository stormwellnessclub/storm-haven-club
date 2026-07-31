import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Phone, MessageSquare, CalendarPlus, NotebookPen, LineChart, Layers,
  Package, ListChecks, MoreHorizontal, Mail, ShieldAlert, Target, Clock,
  FileText, History, Users, Activity, Lock,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMEmpty, PTMError, PTMLabel, PTMListSkeleton,
  PTMRow, PTMSkeleton, PTMStat, ptmButtonClass,
} from "@/components/admin/pt/mobile/PTMobileUI";
import {
  PTMAccordion, PTMAlert, PTMAvatar, PTMPackageBalance, PTMSheet,
} from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";
import {
  usePTMClientSummary, usePTMLazySection, usePTMClientActions,
  ptmFormatDate, ptmFormatDateTime, ptmDaysUntil,
} from "@/hooks/pt/usePTMClientProfile";
import { ptmToast } from "@/components/admin/pt/mobile/ptmToast";
import { cn } from "@/lib/utils";

type SheetKey =
  | null | "message" | "note" | "progress" | "program" | "task" | "more" | "package";

export default function PTMClientProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const access = usePTMobileAccess();
  const { data: c, isLoading, error, refetch } = usePTMClientSummary(userId);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const track = (key: string) => (v: boolean) => setOpen((s) => ({ ...s, [key]: s[key] || v }));

  if (isLoading) {
    return (
      <PTMobileShell title="Client" back>
        <div className="space-y-3">
          <PTMSkeleton className="h-32 w-full" />
          <PTMSkeleton className="h-24 w-full" />
          <PTMListSkeleton rows={4} />
        </div>
      </PTMobileShell>
    );
  }

  if (error || !c) {
    return (
      <PTMobileShell title="Client" back>
        <PTMError message={(error as any)?.message ?? "Client not found."} onRetry={() => refetch()} />
      </PTMobileShell>
    );
  }

  const statusTone = c.status === "active" ? "green" : c.status === "paused" ? "amber" : "neutral";
  const packDays = ptmDaysUntil(c.activePackage?.expiresAt);
  const reassessDays = ptmDaysUntil(c.reassessment?.dueOn);

  return (
    <PTMobileShell title={c.name} back>
      {/* ---------------------------------------------------- profile summary */}
      <PTMCard className="p-4">
        <div className="flex items-center gap-3">
          <PTMAvatar name={c.name} src={c.photoUrl} size={60} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-pt-ink">{c.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PTMBadge tone={statusTone as any}>{c.status}</PTMBadge>
              <PTMBadge>{c.isMember ? "Member" : "Non-member"}</PTMBadge>
            </div>
            <p className="mt-1.5 text-[12px] text-pt-muted">
              Since {ptmFormatDate(c.memberSince)} · {c.primaryTrainerName ?? "No primary trainer"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <PTMStat label="Completed" value={c.sessionsCompleted} />
          <PTMStat label="This month" value={c.sessionsThisMonth} />
          <PTMStat label="Attendance" value={c.attendanceRate == null ? "—" : `${c.attendanceRate}%`} />
        </div>
      </PTMCard>

      {/* ------------------------------------------------ priority information */}
      <div className="mt-3 space-y-3">
        {(c.topAlert || c.restrictions.length > 0 || c.injuries.length > 0 || c.medicalClearanceRequired) && (
          <PTMAlert tone={c.topAlert?.severity === "urgent" || c.topAlert?.severity === "high" ? "danger" : "warning"} title="Active restriction">
            <ul className="mt-1 space-y-0.5">
              {c.topAlert && <li>{c.topAlert.message}</li>}
              {c.restrictions.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
              {c.injuries.slice(0, 3).map((r) => <li key={r}>Injury: {r}</li>)}
              {c.medicalClearanceRequired && <li>Medical clearance required</li>}
            </ul>
            {c.openAlerts > 1 && <p className="mt-1">+{c.openAlerts - 1} more open alert(s)</p>}
          </PTMAlert>
        )}

        <PTMCard className="divide-y divide-pt-line">
          <PTMRow
            icon={<Clock className="h-4 w-4" />}
            title={c.nextAppointment ? ptmFormatDateTime(c.nextAppointment.startsAt) : "No upcoming session"}
            subtitle={
              c.nextAppointment
                ? [c.nextAppointment.format?.replace(/_/g, " "), c.nextAppointment.trainerName].filter(Boolean).join(" · ")
                : "Book the next session"
            }
            right={<PTMBadge tone={c.nextAppointment ? "gold" : "neutral"}>Next</PTMBadge>}
            onClick={
              c.nextAppointment
                ? () => navigate(`/admin/pt/m/session/${c.nextAppointment!.id}`)
                : () => navigate(`/admin/pt/schedule?client=${c.userId}`)
            }
          />
          <PTMRow
            icon={<Target className="h-4 w-4" />}
            title={c.primaryGoal ?? "No goal recorded"}
            subtitle="Primary goal"
          />
          <PTMRow
            icon={<Package className="h-4 w-4" />}
            title={c.activePackage ? c.activePackage.name : "No active package"}
            subtitle={
              c.activePackage
                ? `${c.activePackage.remaining} left · expires ${ptmFormatDate(c.activePackage.expiresAt)}`
                : "Sessions will bill as unpaid"
            }
            right={
              c.activePackage ? (
                <PTMBadge tone={packDays != null && packDays <= 14 ? "amber" : "green"}>
                  {c.activePackage.remaining}
                </PTMBadge>
              ) : (
                <PTMBadge tone="red">0</PTMBadge>
              )
            }
            onClick={() => setSheet("package")}
          />
          <PTMRow
            icon={<NotebookPen className="h-4 w-4" />}
            title={c.lastSessionFocus?.focus ?? "No session notes yet"}
            subtitle={c.lastSessionFocus ? `Last focus · ${ptmFormatDate(c.lastSessionFocus.date)}` : "Last session focus"}
          />
          <PTMRow
            icon={<Activity className="h-4 w-4" />}
            title={c.reassessment ? `Reassessment ${ptmFormatDate(c.reassessment.dueOn)}` : "No reassessment scheduled"}
            subtitle={c.reassessment?.programName ?? "Reassessment status"}
            right={
              reassessDays != null ? (
                <PTMBadge tone={reassessDays < 0 ? "red" : reassessDays <= 14 ? "amber" : "neutral"}>
                  {reassessDays < 0 ? "Overdue" : `${reassessDays}d`}
                </PTMBadge>
              ) : undefined
            }
          />
        </PTMCard>
      </div>

      {/* --------------------------------------------------- mobile quick bar */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <QuickAction icon={<CalendarPlus className="h-5 w-5" />} label="Book" disabled={!access.canBookSessions}
          onClick={() => navigate(`/admin/pt/schedule?client=${c.userId}`)} />
        <QuickAction icon={<MessageSquare className="h-5 w-5" />} label="Message" disabled={!access.canMessageClients}
          onClick={() => setSheet("message")} />
        <QuickAction icon={<Phone className="h-5 w-5" />} label="Call" disabled={!c.phone}
          onClick={() => { window.location.href = `tel:${c.phone}`; }} />
        <QuickAction icon={<MoreHorizontal className="h-5 w-5" />} label="More" onClick={() => setSheet("more")} />
      </div>

      {/* --------------------------------------------------- collapsible detail */}
      <div className="mt-4 space-y-2.5">
        <PTMAccordion title="Contact Information">
          <div className="space-y-1">
            <DetailRow label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
            <DetailRow label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
            <DetailRow label="Date of birth" value={c.dateOfBirth ? ptmFormatDate(c.dateOfBirth) : null} />
            <DetailRow label="Membership" value={c.membershipStatus} />
            <DetailRow
              label="Contact prefs"
              value={
                Object.entries(c.communicationPrefs).filter(([, v]) => v).map(([k]) => k).join(", ") || "Email"
              }
            />
          </div>
        </PTMAccordion>

        <PTMAccordion title="Emergency Contact">
          <div className="space-y-1">
            <DetailRow label="Name" value={c.emergency.name} />
            <DetailRow
              label="Phone"
              value={c.emergency.phone}
              href={c.emergency.phone ? `tel:${c.emergency.phone}` : undefined}
            />
            <DetailRow label="Relationship" value={c.emergency.relationship} />
          </div>
        </PTMAccordion>

        <NotesSection userId={c.userId} canWriteNotes={access.canWriteNotes} internalNotes={c.internalNotes}
          medicalNotes={c.medicalNotes} onOpen={track("notes")} isOpen={!!open.notes} />

        <ProgramsSection userId={c.userId} onOpen={track("programs")} isOpen={!!open.programs} />

        <ProgressSection userId={c.userId} onOpen={track("progress")} isOpen={!!open.progress} />

        <AppointmentsSection userId={c.userId} onOpen={track("appts")} isOpen={!!open.appts}
          onSelect={(id) => navigate(`/admin/pt/m/session/${id}`)} />

        <PackagesSection userId={c.userId} onOpen={track("packages")} isOpen={!!open.packages} />

        <DocumentsSection userId={c.userId} parqStatus={c.parqStatus} onOpen={track("docs")} isOpen={!!open.docs} />

        <CommunicationSection userId={c.userId} canView={access.canMessageClients}
          onOpen={track("comms")} isOpen={!!open.comms} />

        <AccountHistorySection userId={c.userId} canViewAudit={access.isAdmin}
          onOpen={track("history")} isOpen={!!open.history} />
      </div>

      {/* ------------------------------------------------------------- sheets */}
      <MessageSheet open={sheet === "message"} onClose={() => setSheet(null)} client={c} />
      <NoteSheet open={sheet === "note"} onClose={() => setSheet(null)} userId={c.userId} canPrivate={access.canWriteNotes} />
      <ProgressSheet open={sheet === "progress"} onClose={() => setSheet(null)} userId={c.userId} />
      <TaskSheet open={sheet === "task"} onClose={() => setSheet(null)} userId={c.userId} />
      <ProgramSheet open={sheet === "program"} onClose={() => setSheet(null)} userId={c.userId}
        canAssign={access.canAssignPackages || access.canWriteNotes} />
      <PackageSheet open={sheet === "package"} onClose={() => setSheet(null)} client={c} />

      <PTMSheet open={sheet === "more"} onOpenChange={(v) => !v && setSheet(null)} title="More actions">
        <div className="space-y-2">
          <SheetAction icon={<CalendarPlus className="h-4 w-4" />} label="Book session" disabled={!access.canBookSessions}
            onClick={() => { setSheet(null); navigate(`/admin/pt/schedule?client=${c.userId}`); }} />
          <SheetAction icon={<NotebookPen className="h-4 w-4" />} label="Add note" disabled={!access.canWriteNotes}
            onClick={() => setSheet("note")} />
          <SheetAction icon={<LineChart className="h-4 w-4" />} label="Record progress" disabled={!access.canRecordProgress}
            onClick={() => setSheet("progress")} />
          <SheetAction icon={<Layers className="h-4 w-4" />} label="Assign or change program" disabled={!access.canWriteNotes}
            onClick={() => setSheet("program")} />
          <SheetAction icon={<Package className="h-4 w-4" />} label="View package" onClick={() => setSheet("package")} />
          <SheetAction icon={<ListChecks className="h-4 w-4" />} label="Create task" disabled={!access.canCreateTasks}
            onClick={() => setSheet("task")} />
          <SheetAction icon={<Users className="h-4 w-4" />} label="Open full desktop profile"
            onClick={() => { setSheet(null); navigate(`/admin/pt/clients/${c.userId}`); }} />
        </div>
      </PTMSheet>
    </PTMobileShell>
  );
}

/* ------------------------------------------------------------- small parts */

function QuickAction({
  icon, label, onClick, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border border-pt-line bg-pt-cream text-pt-ink active:bg-pt-beige",
        disabled && "opacity-40",
      )}
    >
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
    </button>
  );
}

function SheetAction({
  icon, label, onClick, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(ptmButtonClass("outline"), "justify-start", disabled && "opacity-40")}>
      {icon}
      {label}
      {disabled && <Lock className="ml-auto h-3.5 w-3.5 text-pt-muted" />}
    </button>
  );
}

function DetailRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const body = <span className="text-[14px] text-pt-ink">{value || "—"}</span>;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[12px] uppercase tracking-[0.1em] text-pt-muted">{label}</span>
      {href && value ? (
        <a href={href} className="text-[14px] font-medium text-pt-gold underline-offset-2 active:underline">
          {value}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

function SectionBody({ loading, empty, children }: { loading: boolean; empty: boolean; children: React.ReactNode }) {
  if (loading) return <PTMListSkeleton rows={2} />;
  if (empty) return <p className="py-2 text-[13px] text-pt-muted">Nothing recorded yet.</p>;
  return <>{children}</>;
}

/* ------------------------------------------------------- lazy detail blocks */

function NotesSection({
  userId, canWriteNotes, internalNotes, medicalNotes, isOpen, onOpen,
}: {
  userId: string; canWriteNotes: boolean; internalNotes: string | null; medicalNotes: string | null;
  isOpen: boolean; onOpen: (v: boolean) => void;
}) {
  const { data, isLoading } = usePTMLazySection<any>("pt_session_notes", userId, isOpen, {
    orderBy: "session_date", limit: 10,
  });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Notes">
        {canWriteNotes && (internalNotes || medicalNotes) && (
          <div className="mb-3 rounded-xl border border-pt-line bg-pt-beige/60 p-3">
            <PTMLabel>Private · trainers only</PTMLabel>
            {internalNotes && <p className="mt-1 whitespace-pre-wrap text-[13px] text-pt-ink">{internalNotes}</p>}
            {medicalNotes && <p className="mt-2 whitespace-pre-wrap text-[13px] text-pt-ink">Medical: {medicalNotes}</p>}
          </div>
        )}
        {!canWriteNotes && (
          <p className="mb-3 flex items-center gap-2 text-[12px] text-pt-muted">
            <Lock className="h-3.5 w-3.5" /> Private trainer notes are hidden for your role.
          </p>
        )}
        <SectionBody loading={isLoading} empty={!data?.length}>
          <div className="space-y-2">
            {(data ?? []).map((n: any) => (
              <div key={n.id} className="rounded-xl border border-pt-line p-3">
                <p className="text-[12px] text-pt-muted">{ptmFormatDate(n.session_date)}</p>
                {n.observations && <p className="mt-1 text-[13px] text-pt-ink">{n.observations}</p>}
                {n.next_focus && <p className="mt-1 text-[13px] text-pt-muted">Next focus: {n.next_focus}</p>}
              </div>
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function ProgramsSection({ userId, isOpen, onOpen }: { userId: string; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_programs", userId, isOpen, { limit: 10 });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Programs">
        <SectionBody loading={isLoading} empty={!data?.length}>
          <div className="space-y-2">
            {(data ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-pt-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-pt-ink">{p.name}</p>
                  <p className="text-[12px] text-pt-muted">{p.goal || p.phase || "—"}</p>
                </div>
                <PTMBadge tone={p.status === "active" ? "green" : "neutral"}>{p.status}</PTMBadge>
              </div>
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function ProgressSection({ userId, isOpen, onOpen }: { userId: string; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_body_metrics", userId, isOpen, {
    orderBy: "measured_on", limit: 8,
  });
  const prs = usePTMLazySection<any>("pt_prs", userId, isOpen, { orderBy: "achieved_on", limit: 5 });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Progress">
        <SectionBody loading={isLoading} empty={!data?.length && !prs.data?.length}>
          <div className="space-y-2">
            {(data ?? []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-pt-line p-3">
                <span className="text-[13px] text-pt-muted">{ptmFormatDate(m.measured_on)}</span>
                <span className="text-[13px] text-pt-ink">
                  {[m.weight_lbs ? `${m.weight_lbs} lb` : null, m.body_fat_pct ? `${m.body_fat_pct}% bf` : null]
                    .filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            ))}
            {(prs.data ?? []).length > 0 && (
              <>
                <PTMLabel>Recent PRs</PTMLabel>
                {(prs.data ?? []).map((pr: any) => (
                  <div key={pr.id} className="flex items-center justify-between rounded-xl border border-pt-line p-3">
                    <span className="truncate text-[13px] text-pt-ink">{pr.exercise_name ?? "Exercise"}</span>
                    <span className="text-[13px] text-pt-muted">{ptmFormatDate(pr.achieved_on)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function AppointmentsSection({
  userId, isOpen, onOpen, onSelect,
}: { userId: string; isOpen: boolean; onOpen: (v: boolean) => void; onSelect: (id: string) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_appointments", userId, isOpen, {
    orderBy: "starts_at", limit: 20,
  });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Appointments">
        <SectionBody loading={isLoading} empty={!data?.length}>
          <div className="divide-y divide-pt-line">
            {(data ?? []).map((a: any) => (
              <PTMRow
                key={a.id}
                title={ptmFormatDateTime(a.starts_at)}
                subtitle={a.format?.replace(/_/g, " ")}
                right={<PTMBadge tone={a.status === "completed" ? "green" : a.status === "no_show" ? "red" : "neutral"}>{a.status.replace(/_/g, " ")}</PTMBadge>}
                onClick={() => onSelect(a.id)}
              />
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function PackagesSection({ userId, isOpen, onOpen }: { userId: string; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_passes", userId, isOpen, { limit: 15 });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Packages">
        <SectionBody loading={isLoading} empty={!data?.length}>
          <div className="space-y-2">
            {(data ?? []).map((p: any) => (
              <div key={p.id} className="space-y-1">
                <PTMPackageBalance
                  label={`${p.pack_name} · ${p.status}`}
                  used={Math.max((p.sessions_total ?? 0) - (p.sessions_remaining ?? 0), 0)}
                  total={p.sessions_total ?? 0}
                />
                <p className="px-1 text-[12px] text-pt-muted">Expires {ptmFormatDate(p.expires_at)}</p>
              </div>
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function DocumentsSection({
  userId, parqStatus, isOpen, onOpen,
}: { userId: string; parqStatus: string; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_documents", userId, isOpen, { limit: 15 });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Forms & Documents" meta={<PTMBadge tone={parqStatus === "completed" || parqStatus === "cleared" ? "green" : "amber"}>PAR-Q {parqStatus.replace(/_/g, " ")}</PTMBadge>}>
        <SectionBody loading={isLoading} empty={!data?.length}>
          <div className="divide-y divide-pt-line">
            {(data ?? []).map((d: any) => (
              <PTMRow
                key={d.id}
                icon={<FileText className="h-4 w-4" />}
                title={d.title}
                subtitle={`${d.doc_type} · ${d.status}`}
                right={d.expires_at ? <span className="text-[12px] text-pt-muted">{ptmFormatDate(d.expires_at)}</span> : undefined}
              />
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

function CommunicationSection({
  userId, canView, isOpen, onOpen,
}: { userId: string; canView: boolean; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_communications", userId, isOpen && canView, {
    column: "client_user_id", limit: 15,
  });
  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Communication History">
        {!canView ? (
          <p className="flex items-center gap-2 py-2 text-[13px] text-pt-muted">
            <Lock className="h-3.5 w-3.5" /> Restricted for your role.
          </p>
        ) : (
          <SectionBody loading={isLoading} empty={!data?.length}>
            <div className="space-y-2">
              {(data ?? []).map((m: any) => (
                <div key={m.id} className="rounded-xl border border-pt-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <PTMBadge tone={m.direction === "inbound" ? "gold" : "neutral"}>{m.channel}</PTMBadge>
                    <span className="text-[12px] text-pt-muted">{ptmFormatDate(m.sent_at ?? m.created_at)}</span>
                  </div>
                  {m.subject && <p className="mt-1 text-[13px] font-medium text-pt-ink">{m.subject}</p>}
                  <p className="mt-0.5 line-clamp-3 text-[13px] text-pt-muted">{m.body}</p>
                </div>
              ))}
            </div>
          </SectionBody>
        )}
      </PTMAccordion>
    </div>
  );
}

function AccountHistorySection({
  userId, canViewAudit, isOpen, onOpen,
}: { userId: string; canViewAudit: boolean; isOpen: boolean; onOpen: (v: boolean) => void }) {
  const activity = usePTMLazySection<any>("pt_activity_log", userId, isOpen, { limit: 20 });
  const audit = usePTMLazySection<any>("pt_audit_log", userId, isOpen && canViewAudit, {
    column: "client_user_id", limit: 20,
  });
  const rows = useMemo(() => {
    const a = (activity.data ?? []).map((r: any) => ({
      id: r.id, when: r.created_at, label: r.action?.replace(/_/g, " "), detail: r.detail,
    }));
    const b = canViewAudit
      ? (audit.data ?? []).map((r: any) => ({
          id: r.id, when: r.created_at, label: `${r.action} ${r.entity_type}`.replace(/_/g, " "), detail: null,
        }))
      : [];
    return [...a, ...b].sort((x, y) => String(y.when).localeCompare(String(x.when))).slice(0, 30);
  }, [activity.data, audit.data, canViewAudit]);

  return (
    <div onClickCapture={() => onOpen(true)}>
      <PTMAccordion title="Account History">
        <SectionBody loading={activity.isLoading} empty={!rows.length}>
          <div className="divide-y divide-pt-line">
            {rows.map((r) => (
              <PTMRow key={r.id} icon={<History className="h-4 w-4" />} title={r.label || "Activity"}
                subtitle={[r.detail, ptmFormatDate(r.when)].filter(Boolean).join(" · ")} />
            ))}
          </div>
        </SectionBody>
      </PTMAccordion>
    </div>
  );
}

/* -------------------------------------------------------------- action sheets */

function MessageSheet({ open, onClose, client }: { open: boolean; onClose: () => void; client: any }) {
  const { logCommunication } = usePTMClientActions(client.userId);
  const [channel, setChannel] = useState("email");
  const [body, setBody] = useState("");

  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Message client"
      description="Send via your device, then log it to the client record.">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <a href={client.email ? `mailto:${client.email}` : undefined}
            className={cn(ptmButtonClass("outline"), !client.email && "pointer-events-none opacity-40")}>
            <Mail className="h-4 w-4" /> Email
          </a>
          <a href={client.phone ? `sms:${client.phone}` : undefined}
            className={cn(ptmButtonClass("outline"), !client.phone && "pointer-events-none opacity-40")}>
            <MessageSquare className="h-4 w-4" /> Text
          </a>
        </div>
        <div className="flex gap-2">
          {["email", "sms", "call", "in_person"].map((ch) => (
            <button key={ch} type="button" onClick={() => setChannel(ch)}
              className={cn("min-h-[40px] flex-1 rounded-xl text-[12px] font-semibold",
                channel === ch ? "bg-pt-noir text-pt-cream" : "border border-pt-line text-pt-muted")}>
              {ch.replace("_", " ")}
            </button>
          ))}
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          placeholder="What was communicated?"
          className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        <button className={ptmButtonClass("primary")} disabled={!body.trim() || logCommunication.isPending}
          onClick={() => logCommunication.mutate({ channel, body }, { onSuccess: () => { setBody(""); onClose(); } })}>
          Log message
        </button>
      </div>
    </PTMSheet>
  );
}

function NoteSheet({
  open, onClose, userId, canPrivate,
}: { open: boolean; onClose: () => void; userId: string; canPrivate: boolean }) {
  const { addSessionNote, savePrivateNote } = usePTMClientActions(userId);
  const [text, setText] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [privateNote, setPrivateNote] = useState(false);

  const save = () => {
    if (privateNote) {
      savePrivateNote.mutate(text, { onSuccess: () => { setText(""); onClose(); } });
    } else {
      addSessionNote.mutate(
        { observations: text, next_focus: nextFocus },
        { onSuccess: () => { setText(""); setNextFocus(""); onClose(); } },
      );
    }
  };

  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Add note">
      <div className="space-y-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Observation…"
          className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        {!privateNote && (
          <input value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} placeholder="Next-session focus (optional)"
            className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        )}
        {canPrivate && (
          <label className="flex items-center gap-2 text-[13px] text-pt-ink">
            <input type="checkbox" checked={privateNote} onChange={(e) => setPrivateNote(e.target.checked)} />
            Save as private trainer note (not client-visible)
          </label>
        )}
        <button className={ptmButtonClass("primary")} disabled={!text.trim() || addSessionNote.isPending || savePrivateNote.isPending}
          onClick={save}>
          Save note
        </button>
      </div>
    </PTMSheet>
  );
}

function ProgressSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const { recordProgress } = usePTMClientActions(userId);
  const [weight, setWeight] = useState("");
  const [bf, setBf] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Record progress">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="Weight (lb)"
            className="rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
          <input value={bf} onChange={(e) => setBf(e.target.value)} inputMode="decimal" placeholder="Body fat %"
            className="rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes (optional)"
          className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        <button className={ptmButtonClass("primary")} disabled={(!weight && !bf && !notes.trim()) || recordProgress.isPending}
          onClick={() =>
            recordProgress.mutate(
              {
                weight_lbs: weight ? Number(weight) : null,
                body_fat_pct: bf ? Number(bf) : null,
                notes: notes.trim() || null,
              },
              { onSuccess: () => { setWeight(""); setBf(""); setNotes(""); onClose(); } },
            )
          }>
          Save check-in
        </button>
      </div>
    </PTMSheet>
  );
}

function TaskSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const { createTask } = usePTMClientActions(userId);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Create follow-up task">
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title"
          className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
          className="w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink outline-none" />
        <button className={ptmButtonClass("primary")} disabled={!title.trim() || createTask.isPending}
          onClick={() =>
            createTask.mutate(
              { title, due_at: due ? new Date(`${due}T12:00:00`).toISOString() : null },
              { onSuccess: () => { setTitle(""); setDue(""); onClose(); } },
            )
          }>
          Create task
        </button>
      </div>
    </PTMSheet>
  );
}

function ProgramSheet({
  open, onClose, userId, canAssign,
}: { open: boolean; onClose: () => void; userId: string; canAssign: boolean }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_programs", userId, open, { limit: 20 });
  const { assignProgram } = usePTMClientActions(userId);

  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Programs"
      description="Activate an existing program or open the builder for a new one.">
      {isLoading ? (
        <PTMListSkeleton rows={2} />
      ) : (data ?? []).length === 0 ? (
        <PTMEmpty title="No programs yet" description="Build one from the desktop program builder." />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-pt-line p-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-pt-ink">{p.name}</p>
                <p className="text-[12px] text-pt-muted">{p.status}</p>
              </div>
              <button
                className="rounded-full bg-pt-noir px-3 py-2 text-[12px] font-semibold text-pt-cream disabled:opacity-40"
                disabled={!canAssign || assignProgram.isPending}
                onClick={() =>
                  assignProgram.mutate({ programId: p.id, status: p.status === "active" ? "paused" : "active" })
                }
              >
                {p.status === "active" ? "Pause" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </PTMSheet>
  );
}

function PackageSheet({ open, onClose, client }: { open: boolean; onClose: () => void; client: any }) {
  const { data, isLoading } = usePTMLazySection<any>("pt_passes", client.userId, open, { limit: 15 });
  return (
    <PTMSheet open={open} onOpenChange={(v) => !v && onClose()} title="Packages">
      {isLoading ? (
        <PTMListSkeleton rows={2} />
      ) : (data ?? []).length === 0 ? (
        <PTMEmpty title="No packages" description="Sessions will be billed as unpaid." />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((p: any) => (
            <div key={p.id}>
              <PTMPackageBalance
                label={`${p.pack_name} · ${p.status}`}
                used={Math.max((p.sessions_total ?? 0) - (p.sessions_remaining ?? 0), 0)}
                total={p.sessions_total ?? 0}
              />
              <p className="mt-1 px-1 text-[12px] text-pt-muted">Expires {ptmFormatDate(p.expires_at)}</p>
            </div>
          ))}
        </div>
      )}
    </PTMSheet>
  );
}
