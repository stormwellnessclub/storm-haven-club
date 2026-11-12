import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AellaSculptProgressPanel } from "./AellaSculptProgressPanel";
import { CONSENT_SECTIONS, PHOTO_NOTE, reviewLabel } from "@/lib/aellaSculptForms";
import {
  useAcknowledgeSculptConsent, usePhotoConsent, useRecordScreeningReview, useScreeningReviews, useSculptConsent, useSculptFormStatus, useSculptIntake,
  type SculptConsent, type SculptFormStatus, type SculptIntake, type ScreeningReview,
} from "@/hooks/useAellaSculptForms";

const PROVIDER_ROLES = ["super_admin", "admin", "manager", "spa_staff"] as const;
const when = (iso: string | null | undefined) => (iso ? format(parseISO(iso), "MMM d, yyyy · h:mm a") : "");
const ANSWER_LABEL: Record<string, string> = { yes: "Yes", no: "No", not_sure: "Not Sure" };

/** Who may read health answers: spa providers and managers. Everyone else sees completion only. */
export function useCanSeeSculptAnswers() {
  const { hasAnyRole } = useUserRoles();
  return hasAnyRole([...PROVIDER_ROLES]);
}

function useAppointmentUser(appointmentId: string | null) {
  return useQuery({
    queryKey: ["spa-appt-user", appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => ((await (supabase.from as any)("spa_appointments").select("user_id").eq("id", appointmentId).maybeSingle()).data?.user_id ?? null) as string | null,
  });
}

/** Everything for one Aella Sculpt appointment's forms, loaded only for staff allowed to read it. */
export function useSculptFormsForAppointment(appointmentId: string | null, enabled = true) {
  const canSee = useCanSeeSculptAnswers();
  const status = useSculptFormStatus(enabled && appointmentId ? [appointmentId] : []);
  const st = appointmentId ? status.data?.get(appointmentId) ?? null : null;
  const { data: userId } = useAppointmentUser(enabled && canSee ? appointmentId : null);
  const intake = useSculptIntake(enabled && canSee ? st?.intake_appointment_id ?? null : null);
  const consent = useSculptConsent(enabled && canSee && userId ? appointmentId : null, userId);
  const photo = usePhotoConsent(enabled && canSee ? userId : null);
  const reviews = useScreeningReviews(enabled && canSee ? intake.data?.own?.id : null);
  return {
    canSee, userId: userId ?? null, status: st, statusLoading: status.isLoading, intake: intake.data?.own ?? null, consent: consent.data?.latest ?? null,
    photo: photo.data ?? null, reviews: reviews.data ?? [], loading: intake.isLoading || consent.isLoading,
  };
}

export function SculptStatusLines({ st }: { st: SculptFormStatus | null }) {
  const row = (label: string, value: string, tone: "ok" | "warn" | "bad" | "muted") => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Badge variant={tone === "bad" ? "destructive" : tone === "ok" ? "default" : tone === "warn" ? "secondary" : "outline"}>{value}</Badge>
    </div>
  );
  const review = st?.review_state ?? "pending";
  return (
    <div className="space-y-1.5">
      {row("Aella Sculpt Intake", st?.intake_done ? "Complete" : "Pending", st?.intake_done ? "ok" : "warn")}
      {row("Treatment Consent", st?.consent_done ? (st.provider_ack ? "Complete · Acknowledged" : "Complete") : "Pending", st?.consent_done ? "ok" : "warn")}
      {row("Provider Review", reviewLabel(review, st?.review_decision), review === "required" ? "bad" : review === "completed" ? (st?.review_decision === "not_cleared" ? "bad" : "ok") : review === "clear" ? "ok" : "muted")}
      {row("Progress photos", st?.photo_consent == null ? "Not answered" : st.photo_consent ? "Consented" : "Declined", "muted")}
    </div>
  );
}

/** Read-only summary of the intake, consent and photography answers (also used for printing). */
export function SculptFormsSummary({ intake, consent, photo, reviews }: {
  intake: SculptIntake | null; consent: SculptConsent | null; photo: { consent: boolean; decided_at: string } | null; reviews: ScreeningReview[];
}) {
  const sections: { name: string; items: SculptIntake["answers_snapshot"] }[] = [];
  for (const a of intake?.answers_snapshot ?? []) {
    const last = sections[sections.length - 1];
    if (last && last.name === a.section) last.items.push(a); else sections.push({ name: a.section, items: [a] });
  }
  return (
    <div className="space-y-6 text-sm">
      <section data-intake-field className="space-y-2">
        <h3 className="font-semibold">Aella Sculpt Health &amp; Treatment Intake</h3>
        {!intake ? <p className="text-muted-foreground">Not completed yet.</p> : (
          <>
            <p className="text-muted-foreground">Submitted {when(intake.submitted_at)}{intake.updated_at !== intake.submitted_at ? ` · updated ${when(intake.updated_at)}` : ""}</p>
            <p><span className="text-muted-foreground">Treatment area:</span> {intake.zone_name ?? "—"}</p>
            {sections.map((s) => (
              <div key={s.name} className="space-y-2 pt-2">
                <h4 className="font-medium">{s.name}</h4>
                {s.items.map((a) => (
                  <div key={a.id} data-intake-field className={`rounded-md border p-2 ${a.flag === "hold" ? "border-destructive" : a.flag === "review" ? "border-accent" : ""}`}>
                    <p className="text-xs text-muted-foreground">{a.title ? `${a.title} · ` : ""}{a.prompt}</p>
                    <p className="font-medium">{a.answer.length ? a.answer.map((v) => ANSWER_LABEL[v] ?? v).join(", ") : "—"}</p>
                    {a.detail && <p className="mt-1">{a.detail_prompt ? <span className="text-muted-foreground">{a.detail_prompt} </span> : null}{a.detail}</p>}
                    {a.flag && <p className={`mt-1 text-xs font-medium ${a.flag === "hold" ? "text-destructive" : ""}`}>{a.flag === "hold" ? "Not cleared until a provider clears it" : "Provider review"}</p>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </section>

      <section data-intake-field className="space-y-2">
        <h3 className="font-semibold">Aella Sculpt Treatment Consent</h3>
        {!consent ? <p className="text-muted-foreground">Not signed yet.</p> : (
          <>
            <ul className="space-y-0.5">
              {CONSENT_SECTIONS.map((s) => <li key={s.key}>{consent.acknowledgements?.[s.key] ? "✓" : "✗"} {s.title}</li>)}
              <li>{consent.consent_agreed ? "✓" : "✗"} Consents to receive Aella Sculpt treatment</li>
            </ul>
            <p><span className="text-muted-foreground">Printed name:</span> {consent.printed_name} · <span className="text-muted-foreground">Date:</span> {format(parseISO(consent.signed_on), "MMM d, yyyy")}</p>
            <img src={consent.signature_image} alt="Client signature" className="signature-light h-20 rounded border bg-background" />
            <p>{consent.provider_ack_at ? `Provider acknowledgement: ${consent.provider_ack_name ?? "Provider"} · ${when(consent.provider_ack_at)}` : "Provider acknowledgement: not yet"}</p>
          </>
        )}
      </section>

      <section data-intake-field className="space-y-1">
        <h3 className="font-semibold">Progress Photography Consent</h3>
        <p>{photo == null ? "Not answered" : photo.consent ? "Yes — photographs may be taken and stored privately in the treatment record." : "No — does not consent to progress photography."}{photo ? ` (${when(photo.decided_at)})` : ""}</p>
        <p className="text-xs text-muted-foreground">{PHOTO_NOTE}</p>
      </section>

      {reviews.length > 0 && (
        <section data-intake-field className="space-y-2">
          <h3 className="font-semibold">Provider review history (internal)</h3>
          {reviews.map((r) => (
            <div key={r.id} className="rounded-md border p-2">
              <p className="font-medium">{r.decision === "cleared" ? "Cleared for treatment" : "Not cleared for treatment"} · {r.reviewer_name ?? "Staff"} · {when(r.reviewed_at)}</p>
              <p>{r.note}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Staff view on the appointment: statuses for everyone; answers, review and acknowledgement for providers. */
export function AellaSculptStaffPanel({ appointmentId }: { appointmentId: string | null | undefined }) {
  const f = useSculptFormsForAppointment(appointmentId ?? null);
  const record = useRecordScreeningReview();
  const ack = useAcknowledgeSculptConsent();
  const [decision, setDecision] = useState<"cleared" | "not_cleared" | null>(null);
  const [note, setNote] = useState("");
  if (!appointmentId) return null;
  return (
    <div className="space-y-4">
      {f.statusLoading ? <p className="text-sm text-muted-foreground">Loading forms…</p> : <SculptStatusLines st={f.status} />}
      {!f.canSee ? (
        <p className="text-xs text-muted-foreground">Health answers are visible to spa providers and managers only.</p>
      ) : f.loading ? <p className="text-sm text-muted-foreground">Loading answers…</p> : (
        <>
          {f.consent && !f.consent.provider_ack_at && (
            <Button type="button" size="sm" variant="outline" disabled={ack.isPending} onClick={() => ack.mutate(f.consent!.id)}>
              {ack.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add provider acknowledgement to consent
            </Button>
          )}
          {f.intake && (
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Record provider review</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={decision === "cleared" ? "default" : "outline"} onClick={() => setDecision("cleared")}>Cleared for treatment</Button>
                <Button type="button" size="sm" variant={decision === "not_cleared" ? "destructive" : "outline"} onClick={() => setDecision("not_cleared")}>Not cleared for treatment</Button>
              </div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Reason for clearance or denial (internal — the client never sees this)" />
              <Button type="button" size="sm" disabled={!decision || note.trim().length < 3 || record.isPending}
                onClick={async () => { await record.mutateAsync({ intakeId: f.intake!.id, decision: decision!, note }); setDecision(null); setNote(""); }}>
                {record.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save review
              </Button>
            </div>
          )}
          <SculptFormsSummary intake={f.intake} consent={f.consent} photo={f.photo} reviews={f.reviews} />
          <AellaSculptProgressPanel appointmentId={appointmentId} userId={f.userId} photoConsent={f.photo?.consent ?? null} />
        </>
      )}
    </div>
  );
}
