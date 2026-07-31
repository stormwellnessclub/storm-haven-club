import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Bell, ChevronRight, Clock, MapPin, User, Activity, RefreshCw,
  FileText, PhoneCall, PackageX, ClipboardCheck, HelpCircle, AlertTriangle,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMSectionTitle, PTMEmpty, PTMListSkeleton, PTMLabel,
} from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMAvatar } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMToday, type PTMTodayAppointment } from "@/hooks/pt/usePTMToday";
import { useIsPTAdmin } from "@/hooks/pt/usePTAccess";
import { PT_LIFECYCLE_LABEL, PT_LIFECYCLE_STYLE } from "@/hooks/pt/usePTSchedule";
import { cn } from "@/lib/utils";

const timeOf = (iso: string) => format(new Date(iso), "h:mm a");

function untilLabel(iso: string) {
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  if (diff <= 0) return "Now";
  return `in ${formatDistanceToNowStrict(new Date(iso))}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatusDot({ lifecycle }: { lifecycle: PTMTodayAppointment["lifecycle"] }) {
  const style = PT_LIFECYCLE_STYLE[lifecycle];
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", style.bar)} aria-hidden />;
}

function TimelineRow({ a, onOpen }: { a: PTMTodayAppointment; onOpen: () => void }) {
  const style = PT_LIFECYCLE_STYLE[a.lifecycle];
  const dim = a.lifecycle === "cancelled" || a.lifecycle === "no_show";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-3 text-left active:opacity-80"
    >
      <div className="flex w-[62px] shrink-0 flex-col items-end pt-3">
        <span className="text-[13px] font-semibold text-pt-ink">{timeOf(a.startsAt)}</span>
        <span className="text-[11px] text-pt-muted">{a.durationMinutes}m</span>
      </div>
      <div className="relative flex w-3 shrink-0 justify-center">
        <span className="absolute inset-y-0 w-px bg-pt-line" aria-hidden />
        <span className={cn("relative z-10 mt-4 h-2.5 w-2.5 rounded-full ring-4 ring-pt-cream", style.bar)} />
      </div>
      <div
        className={cn(
          "mb-3 min-w-0 flex-1 rounded-2xl border border-pt-line bg-white px-3 py-3",
          a.lifecycle === "in_progress" && "border-pt-gold ring-1 ring-pt-gold/40",
          dim && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-[15px] font-semibold text-pt-ink", dim && "line-through")}>
            {a.clientName}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusDot lifecycle={a.lifecycle} />
            <span className="text-[11px] font-medium text-pt-muted">{PT_LIFECYCLE_LABEL[a.lifecycle]}</span>
          </div>
        </div>
        <p className="mt-1 truncate text-[12px] text-pt-muted">
          {[a.sessionTypeName, a.locationName].filter(Boolean).join(" · ") || "Session"}
        </p>
      </div>
    </button>
  );
}

export default function PTMToday() {
  const navigate = useNavigate();
  const isAdmin = useIsPTAdmin();
  const { data, isLoading, refetch, isRefetching } = usePTMToday({ isAdmin });
  const [pullPx, setPullPx] = useState(0);
  const startY = useRef<number | null>(null);

  const appts = data?.appointments ?? [];
  const upNext = data?.active ?? data?.upNext ?? null;

  const actionItems = useMemo(() => {
    const a = data?.actions;
    return [
      { key: "notes", label: "Session notes to complete", count: a?.notesToComplete ?? 0, icon: FileText, to: "/admin/pt/m/list/notes" },
      { key: "followups", label: "Client follow-ups", count: a?.followUps ?? 0, icon: PhoneCall, to: "/admin/pt/m/list/follow-ups" },
      { key: "packages", label: "Packages expiring", count: a?.packagesExpiring ?? 0, icon: PackageX, to: "/admin/pt/m/list/packages-expiring" },
      { key: "reassess", label: "Reassessments due", count: a?.reassessmentsDue ?? 0, icon: ClipboardCheck, to: "/admin/pt/m/list/reassessments" },
      { key: "unconfirmed", label: "Unconfirmed appointments", count: a?.unconfirmed ?? 0, icon: HelpCircle, to: "/admin/pt/m/list/unconfirmed" },
      { key: "alerts", label: "Unresolved client alerts", count: a?.openAlerts ?? 0, icon: AlertTriangle, to: "/admin/pt/m/list/alerts" },
    ];
  }, [data]);

  return (
    <PTMobileShell
      title="Today"
      right={
        <button
          aria-label="Notifications"
          onClick={() => navigate("/admin/pt/m/list/alerts")}
          className="relative flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <Bell className="h-5 w-5" />
          {(data?.actions.openAlerts ?? 0) > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pt-gold" />
          )}
        </button>
      }
      headerAccessory={
        <div className="px-4 pb-4">
          <p className="text-[13px] text-pt-cream/70">
            {greeting()}, {data?.trainerName || "there"}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-[22px] font-semibold tracking-tight">
              {appts.length} {appts.length === 1 ? "session" : "sessions"} today
            </p>
            <p className="shrink-0 text-[12px] text-pt-cream/60">{format(new Date(), "EEE, MMM d")}</p>
          </div>
        </div>
      }
    >
      <div
        onTouchStart={(e) => { if (window.scrollY <= 0) startY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          if (startY.current == null) return;
          const dy = e.touches[0].clientY - startY.current;
          if (dy > 0) setPullPx(Math.min(dy / 2, 70));
        }}
        onTouchEnd={() => {
          if (pullPx > 45) refetch();
          setPullPx(0);
          startY.current = null;
        }}
      >
        {(pullPx > 0 || isRefetching) && (
          <div className="flex items-center justify-center pb-2 text-pt-muted" style={{ height: isRefetching ? 28 : pullPx }}>
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </div>
        )}

        {isLoading ? (
          <PTMListSkeleton rows={4} />
        ) : (
          <>
            {/* Up next / active */}
            {upNext ? (
              <PTMCard
                onClick={() => navigate(`/admin/pt/m/session/${upNext.id}`)}
                className={cn(
                  "mb-5 border-pt-gold/60 bg-white p-4",
                  upNext.lifecycle === "in_progress" && "ring-1 ring-pt-gold",
                )}
              >
                <div className="flex items-center justify-between">
                  <PTMLabel>{upNext.lifecycle === "in_progress" ? "In session now" : "Up next"}</PTMLabel>
                  <PTMBadge tone={PT_LIFECYCLE_STYLE[upNext.lifecycle].badge as any}>
                    {PT_LIFECYCLE_LABEL[upNext.lifecycle]}
                  </PTMBadge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <PTMAvatar name={upNext.clientName} src={upNext.photoUrl} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold text-pt-ink">{upNext.clientName}</p>
                    <p className="truncate text-[13px] text-pt-muted">{upNext.sessionTypeName || "Session"}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-pt-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[26px] font-semibold leading-none text-pt-ink">{timeOf(upNext.startsAt)}</span>
                  <span className="rounded-full bg-pt-gold/15 px-2 py-0.5 text-[12px] font-semibold text-pt-gold">
                    {upNext.lifecycle === "in_progress" ? "In progress" : untilLabel(upNext.startsAt)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-pt-muted">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{upNext.durationMinutes} min</span>
                  {upNext.locationName && (
                    <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{upNext.locationName}</span></span>
                  )}
                  {upNext.trainerName && (
                    <span className="inline-flex min-w-0 items-center gap-1"><User className="h-3.5 w-3.5" /><span className="truncate">{upNext.trainerName}</span></span>
                  )}
                </div>
              </PTMCard>
            ) : (
              <PTMCard className="mb-5 p-4">
                <PTMLabel>Up next</PTMLabel>
                <p className="mt-2 text-[14px] text-pt-muted">No more sessions scheduled today.</p>
              </PTMCard>
            )}

            {/* Timeline */}
            <PTMSectionTitle
              action={
                <button
                  onClick={() => refetch()}
                  className="text-[12px] font-medium text-pt-muted active:opacity-70"
                >
                  Refresh
                </button>
              }
            >
              Today’s timeline
            </PTMSectionTitle>
            {appts.length === 0 ? (
              <PTMEmpty
                title="No sessions today"
                description="Enjoy the breathing room — or book a session from the Quick Add button."
              />
            ) : (
              <div className="pt-1">
                {appts.map((a) => (
                  <TimelineRow key={a.id} a={a} onOpen={() => navigate(`/admin/pt/m/session/${a.id}`)} />
                ))}
              </div>
            )}

            {/* Action items */}
            <div className="mt-6">
              <PTMSectionTitle>Action items</PTMSectionTitle>
              <div className="overflow-hidden rounded-2xl border border-pt-line bg-white">
                {actionItems.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-pt-beige",
                      i > 0 && "border-t border-pt-line",
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0 text-pt-muted" />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-pt-ink">{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[12px] font-semibold",
                        item.count > 0 ? "bg-pt-gold/15 text-pt-gold" : "bg-pt-beige text-pt-muted",
                      )}
                    >
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pt-muted" />
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-pt-muted">
              <Activity className="h-3.5 w-3.5" />
              {data?.scopedToTrainer ? "Showing your assigned clients" : "Showing all trainers"}
            </p>
          </>
        )}
      </div>
    </PTMobileShell>
  );
}
