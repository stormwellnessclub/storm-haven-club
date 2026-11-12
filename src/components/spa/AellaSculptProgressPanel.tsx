import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  changeSinceFirst, cleanMeasurements, defaultTreatmentNumber, formatChange, PHOTO_VIEWS, SCULPT_MODALITIES, suggestedMeasurements,
  type MeasurementDraft, type MeasureUnit,
} from "@/lib/aellaSculptProgress";
import {
  useDeleteProgressPhoto, useSaveSculptProgress, useSculptProgressHistory, useSculptVisits, useUploadProgressPhoto,
  type SculptProgress, type SculptProgressPhoto,
} from "@/hooks/useAellaSculptProgress";

const day = (d: string) => format(parseISO(d), "MMM d, yyyy");
const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function useSeries(packageId: string | null | undefined) {
  return useQuery({
    queryKey: ["sculpt-series", packageId],
    enabled: !!packageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("spa_client_packages").select("package_name, sessions_total, expires_on").eq("id", packageId).maybeSingle();
      if (error) throw error;
      return data as { package_name: string; sessions_total: number; expires_on: string | null } | null;
    },
  });
}

function Photos({ photos, onRemove, removing }: { photos: SculptProgressPhoto[]; onRemove?: (p: SculptProgressPhoto) => void; removing?: boolean }) {
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <figure key={p.id} className="w-24 space-y-1">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`${p.view_label} progress photo`} className="h-28 w-24 rounded border object-cover" /></a>
          ) : <div className="h-28 w-24 rounded border bg-muted" />}
          <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
            {p.view_label}
            {onRemove && (
              <button type="button" aria-label={`Remove ${p.view_label} photo`} disabled={removing} onClick={() => { if (confirm("Remove this progress photo permanently?")) onRemove(p); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Provider-only progress record for one Aella Sculpt appointment, plus the client's earlier records. */
export function AellaSculptProgressPanel({ appointmentId, userId, photoConsent }: {
  appointmentId: string; userId: string | null | undefined; photoConsent: boolean | null | undefined;
}) {
  const visits = useSculptVisits(userId);
  const history = useSculptProgressHistory(userId);
  const save = useSaveSculptProgress();
  const upload = useUploadProgressPhoto();
  const remove = useDeleteProgressPhoto();

  const visit = visits.data?.find((v) => v.id === appointmentId) ?? null;
  const record = history.data?.find((r) => r.appointment_id === appointmentId) ?? null;
  const series = useSeries(visit?.client_package_id);
  const earlierRecords = (history.data ?? []).filter((r) => r.appointment_id !== appointmentId && (!visit || r.recorded_on <= visit.appointment_date));
  const otherVisits = (visits.data ?? []).filter((v) => v.id !== appointmentId);
  const firstVisit = visit ? !otherVisits.some((v) => v.status !== "cancelled" && `${v.appointment_date} ${v.appointment_time}` < `${visit.appointment_date} ${visit.appointment_time}`) : null;
  const seriesUsed = visit?.client_package_id ? (visits.data ?? []).filter((v) => v.client_package_id === visit.client_package_id && v.status !== "cancelled").length : 0;

  const [recordedOn, setRecordedOn] = useState("");
  const [treatmentNumber, setTreatmentNumber] = useState("");
  const [rows, setRows] = useState<MeasurementDraft[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [response, setResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>(PHOTO_VIEWS[0]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form once per appointment: from the saved record, otherwise from sensible defaults.
  useEffect(() => {
    if (!visit || history.isLoading || loadedFor === appointmentId) return;
    const lastUnit: MeasureUnit = earlierRecords.at(-1)?.measurements[0]?.unit ?? "in";
    if (record) {
      setRecordedOn(record.recorded_on);
      setTreatmentNumber(record.treatment_number ? String(record.treatment_number) : "");
      setRows(record.measurements.map((m) => ({ label: m.label, value: String(m.value), unit: m.unit })));
      setModalities(record.modalities);
      setResponse(record.client_response ?? "");
      setNotes(record.provider_notes ?? "");
    } else {
      setRecordedOn(visit.appointment_date);
      setTreatmentNumber(String(defaultTreatmentNumber(visits.data ?? [], visit)));
      const previousLabels = earlierRecords.at(-1)?.measurements.map((m) => m.label);
      setRows((previousLabels?.length ? previousLabels : suggestedMeasurements(visit.treatment_zone_name)).map((label) => ({ label, value: "", unit: lastUnit })));
      setModalities([...SCULPT_MODALITIES]);
      setResponse(""); setNotes("");
    }
    setLoadedFor(appointmentId);
  }, [visit, record, history.isLoading, appointmentId, loadedFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const allModalities = useMemo(() => [...SCULPT_MODALITIES, ...modalities.filter((m) => !(SCULPT_MODALITIES as readonly string[]).includes(m))], [modalities]);

  if (!userId) return <p className="text-sm text-muted-foreground">Progress tracking needs the client's account on this appointment.</p>;
  if (visits.isLoading || history.isLoading) return <p className="text-sm text-muted-foreground">Loading progress…</p>;
  if (visits.error || history.error) return <p className="text-sm text-destructive">Could not load progress. Please reopen the appointment.</p>;
  if (!visit) return null;

  const setRow = (i: number, patch: Partial<MeasurementDraft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const onSave = async () => {
    setError(null);
    const m = cleanMeasurements(rows);
    if (m.ok === false) { setError(m.error); return; }
    const n = treatmentNumber.trim() ? Number(treatmentNumber) : null;
    if (n != null && (!Number.isInteger(n) || n < 1 || n > 99)) { setError("Treatment number must be a whole number from 1 to 99."); return; }
    await save.mutateAsync({ appointmentId, recordedOn: recordedOn || visit.appointment_date, treatmentNumber: n, measurements: m.measurements, modalities, clientResponse: response, providerNotes: notes });
  };

  return (
    <div className="space-y-5 rounded-md border p-3">
      <div>
        <p className="text-sm font-semibold">Aella Sculpt progress</p>
        <p className="text-xs text-muted-foreground">Providers and managers only. The client never sees these notes, measurements or photos.</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Visit</dt><dd>{firstVisit ? "First Aella Sculpt visit" : "Returning client"}</dd>
        <dt className="text-muted-foreground">Area</dt><dd>{visit.treatment_zone_name ?? "—"}</dd>
        <dt className="text-muted-foreground">Provider · room</dt><dd>{visit.therapist ?? "—"}{visit.room ? ` · ${visit.room}` : ""} · {visit.duration_minutes ?? 90} min</dd>
        <dt className="text-muted-foreground">Series</dt>
        <dd>{visit.client_package_id
          ? series.data ? `${series.data.package_name} · ${Math.max(series.data.sessions_total - seriesUsed, 0)} of ${series.data.sessions_total} left${series.data.expires_on ? ` · use by ${day(series.data.expires_on)}` : ""}` : "Loading…"
          : "Single treatment"}</dd>
      </dl>

      <section className="space-y-3">
        <p className="text-sm font-medium">This visit · {day(visit.appointment_date)}</p>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1"><Label htmlFor="sp-date" className="text-xs">Date</Label><Input id="sp-date" type="date" className="h-9 w-40" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="sp-num" className="text-xs">Treatment # in series</Label><Input id="sp-num" inputMode="numeric" className="h-9 w-24" value={treatmentNumber} onChange={(e) => setTreatmentNumber(e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Measurements (optional — leave blank if not measured today)</p>
          {rows.map((r, i) => {
            const v = Number(r.value);
            const change = r.label.trim() && v > 0 ? changeSinceFirst(earlierRecords, { label: r.label, value: v, unit: r.unit }, recordedOn || visit.appointment_date) : null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Measurement name" className="h-9 w-44" value={r.label} maxLength={60} onChange={(e) => setRow(i, { label: e.target.value })} />
                <Input aria-label={`${r.label || "Measurement"} value`} inputMode="decimal" className="h-9 w-20" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                <select aria-label="Unit" className={selectCls} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value as MeasureUnit })}>
                  <option value="in">in</option><option value="cm">cm</option>
                </select>
                {change != null && <span className="text-xs text-muted-foreground">{formatChange(change, r.unit)} since first record</span>}
                <button type="button" aria-label="Remove measurement" className="text-muted-foreground" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
          <Button type="button" size="sm" variant="ghost" onClick={() => setRows((x) => [...x, { label: "", value: "", unit: x.at(-1)?.unit ?? "in" }])}><Plus className="h-4 w-4 mr-1" />Add measurement</Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Modalities performed</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {allModalities.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox checked={modalities.includes(m)} onCheckedChange={(c) => setModalities((x) => (c ? [...x, m] : x.filter((y) => y !== m)))} />{m}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1"><Label htmlFor="sp-resp" className="text-xs">Client response</Label>
          <Textarea id="sp-resp" rows={2} maxLength={4000} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="How the client felt during and after (comfort, warmth, skin response)" /></div>
        <div className="space-y-1"><Label htmlFor="sp-notes" className="text-xs">Provider notes (internal)</Label>
          <Textarea id="sp-notes" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Settings, adjustments, recommendation for the series" /></div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={save.isPending} onClick={onSave}>{save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{record ? "Update progress" : "Save progress"}</Button>
          {record && <span className="text-xs text-muted-foreground">Last saved by {record.recorded_by_name ?? "staff"} · {format(parseISO(record.updated_at), "MMM d, h:mm a")}</span>}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Progress photos</p>
        {photoConsent !== true ? (
          <p className="text-sm text-muted-foreground">{photoConsent === false ? "The client declined progress photography. Don't take photos." : "The client hasn't answered the progress photography question yet. Don't take photos until they agree."}</p>
        ) : !record ? (
          <p className="text-sm text-muted-foreground">Save this visit's progress first, then add photos.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Private treatment record only. Not for marketing, social media or the website.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Photo view" className={selectCls} value={view} onChange={(e) => setView(e.target.value)}>
                {PHOTO_VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <Input type="file" accept="image/*" capture="environment" className="h-9 w-56" disabled={upload.isPending}
                onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await upload.mutateAsync({ progressId: record.id, userId, file: f, viewLabel: view }).catch(() => {}); }} />
              {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </>
        )}
        {record && <Photos photos={record.photos} onRemove={(p) => remove.mutate(p)} removing={remove.isPending} />}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Earlier Aella Sculpt visits</p>
        {otherVisits.length === 0 ? <p className="text-sm text-muted-foreground">None — this is the client's only Aella Sculpt appointment.</p> : (
          <ul className="space-y-2">
            {otherVisits.map((v) => {
              const r = history.data?.find((x) => x.appointment_id === v.id) as SculptProgress | undefined;
              return (
                <li key={v.id} className="rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{day(v.appointment_date)}</span>
                    <span className="text-muted-foreground">{v.treatment_zone_name ?? ""}</span>
                    {r?.treatment_number && <Badge variant="outline">Treatment {r.treatment_number}</Badge>}
                    {v.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
                    {!r && v.status !== "cancelled" && <span className="text-xs text-muted-foreground">No progress recorded</span>}
                  </div>
                  {r && (
                    <div className="mt-1 space-y-1">
                      {r.measurements.length > 0 && <p>{r.measurements.map((m) => {
                        const c = changeSinceFirst(history.data ?? [], m, r.recorded_on);
                        return `${m.label} ${m.value} ${m.unit}${c != null ? ` (${formatChange(c, m.unit)})` : ""}`;
                      }).join(" · ")}</p>}
                      {r.modalities.length > 0 && <p className="text-muted-foreground">{r.modalities.join(", ")}</p>}
                      {r.client_response && <p><span className="text-muted-foreground">Client response:</span> {r.client_response}</p>}
                      {r.provider_notes && <p><span className="text-muted-foreground">Notes:</span> {r.provider_notes}</p>}
                      <Photos photos={r.photos} />
                      <p className="text-xs text-muted-foreground">Recorded by {r.recorded_by_name ?? "staff"}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
