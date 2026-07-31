import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Camera, ChevronDown, Search, Trash2, TrendingDown, TrendingUp, Trophy, Plus, Lock, Image as ImageIcon,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMEmpty, PTMError, PTMLabel, PTMListSkeleton, PTMStat, PTMBadge, ptmButtonClass,
} from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMAvatar, PTMConfirm, PTMSheet, PTMTabs } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";
import {
  PTM_RANGE_OPTIONS, usePTMProgressCards, usePTMProgressData, usePTMProgressMutations,
  usePTMProgressPhotos, usePTMRange, METRIC_FIELDS, type PTMProgressCard,
} from "@/hooks/pt/usePTMProgress";
import { cn } from "@/lib/utils";

const LAST_CLIENT_KEY = "ptm:progress:last-client";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d.slice(0, 10)), "MMM d, yyyy"); } catch { return d; }
};

/** Lightweight inline trend chart — no chart library on the mobile critical path. */
function PTMSparkline({ points, invert }: { points: { date: string; value: number }[]; invert?: boolean }) {
  if (points.length < 2) {
    return <div className="mt-3 h-14 rounded-xl bg-pt-beige/60" />;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 260;
  const h = 56;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.value - min) / span) * (h - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const trendUp = values[values.length - 1] >= values[0];
  const good = invert ? !trendUp : trendUp;
  const stroke = good ? "hsl(var(--pt-green, 145 45% 35%))" : "hsl(var(--pt-red, 4 60% 48%))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ProgressCard({ card }: { card: PTMProgressCard }) {
  const change = card.change;
  const good = change == null || change === 0 ? null : card.invert ? change < 0 : change > 0;
  const Icon = (change ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <PTMCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-pt-muted">{card.label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-pt-ink">{card.current ?? "—"}</span>
            <span className="text-[12px] text-pt-muted">{card.unit}</span>
          </div>
        </div>
        {change != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              good === null ? "bg-pt-beige text-pt-muted" : good ? "bg-pt-green/12 text-pt-green" : "bg-pt-red/12 text-pt-red"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {change > 0 ? "+" : ""}{change} {card.unit}
          </span>
        )}
      </div>

      <PTMSparkline points={card.series} invert={card.invert} />

      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-pt-muted">
        <div>
          <p className="text-pt-muted">Start</p>
          <p className="font-semibold text-pt-ink">{card.start ?? "—"} {card.unit}</p>
          <p>{fmtDate(card.startDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-pt-muted">Latest</p>
          <p className="font-semibold text-pt-ink">{card.latest ?? "—"} {card.unit}</p>
          <p>{fmtDate(card.latestDate)}</p>
        </div>
      </div>
    </PTMCard>
  );
}

export default function PTMProgress() {
  const navigate = useNavigate();
  const access = usePTMobileAccess();
  const [params, setParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | undefined>(
    params.get("client") || localStorage.getItem(LAST_CLIENT_KEY) || undefined
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [metricSheet, setMetricSheet] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const rangeCtl = usePTMRange();
  const directory = usePTClientDirectory();
  const { data, isLoading, error, refetch } = usePTMProgressData(userId, rangeCtl.range);
  const summary = usePTMProgressCards(data, rangeCtl.range);
  const photos = usePTMProgressPhotos(userId);
  const { addMetrics, addPhoto, deletePhoto, confirmPR } = usePTMProgressMutations(userId);

  useEffect(() => {
    if (userId) {
      localStorage.setItem(LAST_CLIENT_KEY, userId);
      if (params.get("client") !== userId) {
        const next = new URLSearchParams(params);
        next.set("client", userId);
        setParams(next, { replace: true });
      }
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = useMemo(
    () => (directory.data ?? []).find((c) => c.userId === userId) ?? null,
    [directory.data, userId]
  );

  const clientRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (directory.data ?? [])
      .filter((r) => (q ? `${r.name} ${r.email ?? ""}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [directory.data, search]);

  const rangeLabel = PTM_RANGE_OPTIONS.find((o) => o.key === rangeCtl.key)?.label ?? "Range";

  /* -------------------------------------------------- metric entry form */
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [metricDate, setMetricDate] = useState(new Date().toISOString().slice(0, 10));
  const [metricNotes, setMetricNotes] = useState("");

  /* -------------------------------------------------- photo upload form */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPose, setPhotoPose] = useState("front");
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoNotes, setPhotoNotes] = useState("");

  const photoA = (photos.data ?? []).find((p: any) => p.id === compareA);
  const photoB = (photos.data ?? []).find((p: any) => p.id === compareB);

  const header = (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      className="flex w-full items-center gap-3 rounded-2xl border border-pt-line bg-pt-cream p-3 text-left"
    >
      <PTMAvatar name={client?.name} src={client?.photoUrl} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-pt-ink">
          {client?.name ?? "Select a client"}
        </span>
        <span className="block text-[12px] text-pt-muted">Tap to change client</span>
      </span>
      <ChevronDown className="h-4 w-4 text-pt-muted" />
    </button>
  );

  return (
    <PTMobileShell title="Progress">
      {header}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRangeOpen(true)}
          className="min-h-[40px] rounded-full border border-pt-line bg-pt-cream px-4 text-[13px] font-semibold text-pt-ink"
        >
          {rangeCtl.key === "custom" ? `${rangeCtl.range.from} → ${rangeCtl.range.to}` : rangeLabel}
        </button>
        <span className="text-[12px] text-pt-muted">
          {fmtDate(rangeCtl.range.from)} – {fmtDate(rangeCtl.range.to)}
        </span>
      </div>

      <div className="mt-3">
        <PTMTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "metrics", label: "Metrics" },
            { value: "photos", label: "Photos" },
            { value: "prs", label: "Personal Records" },
          ]}
        />
      </div>

      {!userId && (
        <div className="mt-4">
          <PTMEmpty
            title="No client selected"
            description="Choose a client to see their progress snapshot."
            action={
              <button className={ptmButtonClass("primary")} onClick={() => setPickerOpen(true)}>
                Select client
              </button>
            }
          />
        </div>
      )}

      {userId && isLoading && <div className="mt-4"><PTMListSkeleton rows={4} /></div>}
      {userId && error && (
        <div className="mt-4"><PTMError message={(error as any)?.message} onRetry={() => refetch()} /></div>
      )}

      {userId && summary && !isLoading && (
        <div className="mt-4 space-y-4">
          {/* ------------------------------------------------ OVERVIEW */}
          {tab === "overview" && (
            <>
              <div className="flex gap-2">
                <PTMStat label="Attendance" value={summary.attendance.rate != null ? `${summary.attendance.rate}%` : "—"} />
                <PTMStat label="Sessions" value={summary.attendance.completed} />
                <PTMStat label="Compliance" value={summary.compliance != null ? `${summary.compliance}%` : "—"} />
              </div>

              <PTMCard className="p-4">
                <PTMLabel>Attendance</PTMLabel>
                <p className="mt-2 text-[13px] text-pt-muted">
                  {summary.attendance.completed} completed of {summary.attendance.counted} counted sessions
                  {summary.attendance.noShows > 0 ? ` · ${summary.attendance.noShows} no-show` : ""}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pt-beige">
                  <div
                    className="h-full rounded-full bg-pt-gold"
                    style={{ width: `${summary.attendance.rate ?? 0}%` }}
                  />
                </div>
              </PTMCard>

              <PTMCard className="p-4">
                <PTMLabel>Workout compliance</PTMLabel>
                <p className="mt-2 text-[13px] text-pt-muted">
                  {summary.complianceCompleted} of {summary.compliancePlanned} planned exercises completed
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pt-beige">
                  <div className="h-full rounded-full bg-pt-green" style={{ width: `${summary.compliance ?? 0}%` }} />
                </div>
              </PTMCard>

              {summary.cards.slice(0, 4).map((c) => <ProgressCard key={c.key} card={c} />)}

              <PTMCard className="p-4">
                <PTMLabel>Strength records</PTMLabel>
                {summary.strengthRecords.length === 0 ? (
                  <p className="mt-2 text-[13px] text-pt-muted">No records logged yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {summary.strengthRecords.slice(0, 5).map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between text-[13px]">
                        <span className="truncate text-pt-ink">{p.exercise}</span>
                        <span className="font-semibold text-pt-ink">
                          {p.weight_lbs} lbs{p.reps ? ` × ${p.reps}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PTMCard>

              <PTMCard className="p-4">
                <PTMLabel>Reassessment</PTMLabel>
                <p className="mt-2 text-[13px] text-pt-muted">
                  Next due: {summary.nextReassessment ? fmtDate(summary.nextReassessment) : "Not scheduled"}
                </p>
                {summary.reassessments.length === 0 ? (
                  <p className="mt-2 text-[13px] text-pt-muted">No reassessment results recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {summary.reassessments.slice(0, 5).map((t: any) => (
                      <li key={t.id} className="flex items-center justify-between text-[13px]">
                        <span className="truncate text-pt-ink">{t.test_name}</span>
                        <span className="text-pt-muted">
                          {t.value != null ? `${t.value} ${t.unit ?? ""}` : t.result_text ?? "—"} · {fmtDate(t.tested_on)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PTMCard>
            </>
          )}

          {/* ------------------------------------------------- METRICS */}
          {tab === "metrics" && (
            <>
              {access.canRecordProgress && (
                <button className={ptmButtonClass("primary")} onClick={() => setMetricSheet(true)}>
                  <Plus className="h-4 w-4" /> Record measurements
                </button>
              )}
              {summary.cards.length === 0 ? (
                <PTMEmpty title="No measurements in range" description="Try a wider date range or record a new measurement." />
              ) : (
                summary.cards.map((c) => <ProgressCard key={c.key} card={c} />)
              )}
            </>
          )}

          {/* -------------------------------------------------- PHOTOS */}
          {tab === "photos" && (
            <>
              {access.canRecordProgress ? (
                <div className="flex gap-2">
                  <button className={ptmButtonClass("primary")} onClick={() => setPhotoSheet(true)}>
                    <Camera className="h-4 w-4" /> Add photo
                  </button>
                  <button
                    className={ptmButtonClass("outline")}
                    onClick={() => setCompareOpen(true)}
                    disabled={(photos.data ?? []).length < 2}
                  >
                    Compare
                  </button>
                </div>
              ) : (
                <PTMCard className="flex items-center gap-2 p-4 text-[13px] text-pt-muted">
                  <Lock className="h-4 w-4" /> Progress photos are restricted to training staff.
                </PTMCard>
              )}

              {photos.isLoading && <PTMListSkeleton rows={2} />}
              {access.canRecordProgress && !photos.isLoading && (photos.data ?? []).length === 0 && (
                <PTMEmpty title="No progress photos" description="Upload a front, side or back view to start tracking." />
              )}

              {access.canRecordProgress && (
                <div className="grid grid-cols-2 gap-3">
                  {(photos.data ?? []).map((p: any) => (
                    <div key={p.id} className="overflow-hidden rounded-2xl border border-pt-line bg-pt-cream">
                      {p.url ? (
                        <img src={p.url} alt={`${p.pose ?? "Progress"} photo ${fmtDate(p.taken_on)}`} className="h-40 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-pt-beige text-pt-muted">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold capitalize text-pt-ink">{p.pose ?? "photo"}</p>
                          <p className="text-[11px] text-pt-muted">{fmtDate(p.taken_on)}</p>
                        </div>
                        {access.isAdmin && (
                          <button
                            aria-label="Delete photo"
                            onClick={() => setDeleteTarget(p)}
                            className="p-1 text-pt-red"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ------------------------------------------ PERSONAL RECORDS */}
          {tab === "prs" && (
            <>
              {summary.allPrs.length === 0 ? (
                <PTMEmpty title="No personal records yet" description="PRs are captured automatically during live sessions." />
              ) : (
                summary.allPrs.map((p: any) => {
                  const related = summary.appts.find(
                    (a: any) => a.starts_at?.slice(0, 10) === p.achieved_on?.slice(0, 10)
                  );
                  return (
                    <PTMCard key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-pt-ink">{p.exercise}</p>
                          <p className="mt-0.5 text-[13px] text-pt-muted">Achieved {fmtDate(p.achieved_on)}</p>
                        </div>
                        <PTMBadge tone={p.status === "confirmed" ? "gold" : p.status === "pending" ? "amber" : "neutral"}>
                          {p.status === "confirmed" ? "Confirmed" : p.status === "pending" ? "Pending" : p.status}
                        </PTMBadge>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-pt-ink">
                        <Trophy className="h-4 w-4 text-pt-gold" />
                        {p.weight_lbs} lbs{p.reps ? ` × ${p.reps}` : ""}
                      </div>
                      <p className="mt-1 text-[12px] text-pt-muted">
                        Previous: {p.previous_weight_lbs != null
                          ? `${p.previous_weight_lbs} lbs${p.previous_reps ? ` × ${p.previous_reps}` : ""}`
                          : "No prior record"}
                      </p>
                      {related && (
                        <button
                          className="mt-2 text-[12px] font-semibold text-pt-gold underline"
                          onClick={() => navigate(`/admin/pt/m/session/${related.id}`)}
                        >
                          View related session · {format(parseISO(related.starts_at), "MMM d, h:mm a")}
                        </button>
                      )}
                      {p.status === "pending" && access.canWriteNotes && (
                        <button
                          className={cn(ptmButtonClass("outline"), "mt-3")}
                          onClick={() => confirmPR.mutate({ id: p.id })}
                          disabled={confirmPR.isPending}
                        >
                          Confirm PR
                        </button>
                      )}
                    </PTMCard>
                  );
                })
              )}
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------- client picker */}
      <PTMSheet open={pickerOpen} onOpenChange={setPickerOpen} title="Select client">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pt-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream pl-9 pr-3 text-[15px] text-pt-ink outline-none focus:border-pt-gold focus-visible:ring-1 focus-visible:ring-pt-gold"
          />
        </div>
        <div className="mt-3 max-h-[55dvh] space-y-2 overflow-y-auto">
          {directory.isLoading && <PTMListSkeleton rows={5} />}
          {clientRows.map((c) => (
            <button
              key={c.userId}
              onClick={() => { setUserId(c.userId); setPickerOpen(false); }}
              className="flex w-full items-center gap-3 rounded-xl border border-pt-line bg-pt-cream p-3 text-left"
            >
              <PTMAvatar name={c.name} src={c.photoUrl} size={36} />
              <span className="min-w-0 flex-1 truncate text-[15px] text-pt-ink">{c.name}</span>
              {c.userId === userId && <PTMBadge tone="gold">Selected</PTMBadge>}
            </button>
          ))}
        </div>
      </PTMSheet>

      {/* --------------------------------------------------- range sheet */}
      <PTMSheet open={rangeOpen} onOpenChange={setRangeOpen} title="Date range">
        <div className="grid grid-cols-2 gap-2">
          {PTM_RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => { rangeCtl.setKey(o.key); if (o.key !== "custom") setRangeOpen(false); }}
              className={cn(
                "min-h-[48px] rounded-xl border text-[14px] font-semibold",
                rangeCtl.key === o.key ? "border-pt-noir bg-pt-noir text-pt-cream" : "border-pt-line bg-pt-cream text-pt-ink"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {rangeCtl.key === "custom" && (
          <div className="mt-4 space-y-3">
            <label className="block text-[13px] text-pt-muted">
              From
              <input
                type="date"
                value={rangeCtl.customFrom}
                onChange={(e) => rangeCtl.setCustomFrom(e.target.value)}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink"
              />
            </label>
            <label className="block text-[13px] text-pt-muted">
              To
              <input
                type="date"
                value={rangeCtl.customTo}
                onChange={(e) => rangeCtl.setCustomTo(e.target.value)}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink"
              />
            </label>
            <button className={ptmButtonClass("primary")} onClick={() => setRangeOpen(false)}>Apply</button>
          </div>
        )}
      </PTMSheet>

      {/* -------------------------------------------- record measurements */}
      <PTMSheet
        open={metricSheet}
        onOpenChange={setMetricSheet}
        title="Record measurements"
        description="Leave any field blank to skip it."
        footer={
          <button
            className={ptmButtonClass("primary")}
            disabled={addMetrics.isPending}
            onClick={() =>
              addMetrics.mutate(
                { measuredOn: metricDate, values: metricValues, notes: metricNotes },
                { onSuccess: () => { setMetricSheet(false); setMetricValues({}); setMetricNotes(""); } }
              )
            }
          >
            {addMetrics.isPending ? "Saving…" : "Save measurements"}
          </button>
        }
      >
        <label className="block text-[13px] text-pt-muted">
          Date
          <input
            type="date"
            value={metricDate}
            onChange={(e) => setMetricDate(e.target.value)}
            className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {METRIC_FIELDS.map((f) => (
            <label key={f.key} className="block text-[12px] text-pt-muted">
              {f.label} ({f.unit})
              <input
                inputMode="decimal"
                value={metricValues[f.key] ?? ""}
                onChange={(e) => setMetricValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink"
              />
            </label>
          ))}
        </div>
        <textarea
          value={metricNotes}
          onChange={(e) => setMetricNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={3}
          className="mt-3 w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink"
        />
      </PTMSheet>

      {/* -------------------------------------------------- upload photo */}
      <PTMSheet
        open={photoSheet}
        onOpenChange={setPhotoSheet}
        title="Add progress photo"
        description="Photos are stored privately and only visible to training staff and the client."
        footer={
          <button
            className={ptmButtonClass("primary")}
            disabled={!photoFile || addPhoto.isPending}
            onClick={() =>
              photoFile &&
              addPhoto.mutate(
                { file: photoFile, pose: photoPose, takenOn: photoDate, notes: photoNotes },
                { onSuccess: () => { setPhotoSheet(false); setPhotoFile(null); setPhotoNotes(""); } }
              )
            }
          >
            {addPhoto.isPending ? "Uploading…" : "Upload photo"}
          </button>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="w-full text-[13px] text-pt-muted"
        />
        <div className="mt-3 flex gap-2">
          {["front", "side", "back"].map((p) => (
            <button
              key={p}
              onClick={() => setPhotoPose(p)}
              className={cn(
                "min-h-[44px] flex-1 rounded-xl border text-[14px] font-semibold capitalize",
                photoPose === p ? "border-pt-noir bg-pt-noir text-pt-cream" : "border-pt-line bg-pt-cream text-pt-ink"
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[13px] text-pt-muted">
          Date
          <input
            type="date"
            value={photoDate}
            onChange={(e) => setPhotoDate(e.target.value)}
            className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink"
          />
        </label>
        <textarea
          value={photoNotes}
          onChange={(e) => setPhotoNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-3 w-full rounded-xl border border-pt-line bg-pt-cream p-3 text-[15px] text-pt-ink"
        />
      </PTMSheet>

      {/* ------------------------------------------------- compare photos */}
      <PTMSheet open={compareOpen} onOpenChange={setCompareOpen} title="Compare photos">
        <div className="grid grid-cols-2 gap-2">
          {[{ v: compareA, set: setCompareA, label: "Date A" }, { v: compareB, set: setCompareB, label: "Date B" }].map((s) => (
            <label key={s.label} className="block text-[12px] text-pt-muted">
              {s.label}
              <select
                value={s.v}
                onChange={(e) => s.set(e.target.value)}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream px-2 text-[14px] text-pt-ink"
              >
                <option value="">Select…</option>
                {(photos.data ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {fmtDate(p.taken_on)} · {p.pose ?? "photo"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[photoA, photoB].map((p, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-pt-line bg-pt-beige">
              {p?.url ? (
                <img src={p.url} alt={`Comparison ${i + 1}`} className="h-56 w-full object-cover" />
              ) : (
                <div className="flex h-56 items-center justify-center text-[12px] text-pt-muted">Select a date</div>
              )}
              {p && <p className="px-2 py-1 text-[11px] text-pt-muted">{fmtDate(p.taken_on)} · {p.pose ?? "photo"}</p>}
            </div>
          ))}
        </div>
      </PTMSheet>

      <PTMConfirm
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this photo?"
        description="This permanently removes the photo and its record. This cannot be undone."
        confirmLabel="Delete photo"
        destructive
        onConfirm={() => {
          if (deleteTarget) deletePhoto.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </PTMobileShell>
  );
}
