import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { AlertCircle, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BW_ACKNOWLEDGEMENTS,
  BW_HEALTH_QUESTIONS,
  type BodyWrapIntake,
  usePractitionerSignBodyWrap,
} from "@/hooks/useBodyWrapIntake";

export function BodyWrapIntakeSummary({
  intake,
  staffSignOff = false,
}: {
  intake: BodyWrapIntake | null | undefined;
  staffSignOff?: boolean;
}) {
  const sign = usePractitionerSignBodyWrap();
  const [pName, setPName] = useState("");

  if (!intake) {
    return (
      <div className="p-3 rounded-lg border border-dashed bg-muted/30 flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>No body wrap intake form submitted yet for this appointment.</span>
      </div>
    );
  }
  const fmt = (d?: string | null) => (d ? formatInTimeZone(new Date(d), "America/Detroit", "MMM d, yyyy h:mm a zzz") : "");

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <ClipboardCheck className="h-4 w-4 text-accent" />
        Body Wrap Intake
        {intake.signed_at && <Badge variant="outline" className="text-xs">Signed {fmt(intake.signed_at)}</Badge>}
      </div>
      <Row q="Client" v={[intake.full_name, intake.date_of_birth && `DOB ${intake.date_of_birth}`].filter(Boolean).join(" · ")} />
      <Row q="Contact" v={[intake.phone, intake.email].filter(Boolean).join(" · ")} />
      <Row q="Address" v={intake.address} />
      <Row q="Emergency contact" v={[intake.emergency_contact_name, intake.emergency_contact_phone].filter(Boolean).join(" · ")} />
      <div className="space-y-1">
        <h3 className="font-medium">Health history</h3>
        <p className="text-muted-foreground">Do you have, are you, or have you had any of the following?</p>
        {BW_HEALTH_QUESTIONS.map((q) => (
          <div key={q.key} data-intake-field className="flex items-start justify-between gap-3 py-2 border-b border-border/50">
            <p>{q.label}</p>
            <Badge className="shrink-0" variant={intake.health_answers?.[q.key] === true ? "destructive" : "outline"}>
              {intake.health_answers?.[q.key] === true ? "Yes" : intake.health_answers?.[q.key] === false ? "No" : "Not answered"}
            </Badge>
          </div>
        ))}
      </div>
      <Row q="Tell us more about anything you marked Yes, or any other health condition that could affect your service" v={intake.health_details} />
      <Row q="Any other allergies?" v={intake.other_allergies} />
      <Row q="Current medications" v={intake.medications} />
      <Row q="What personal goals are you hoping to reach with your body wrap?" v={intake.goals} />
      <p className="text-muted-foreground">Please eat a light meal, drink plenty of water before your wrap, and arrive 10 minutes early.</p>
      <Row q="I will eat a light meal and be well hydrated before my session." v={intake.ate_and_hydrated === null ? "Not answered" : intake.ate_and_hydrated ? "Checked — agreed" : "Not checked"} />
      <Row q="Optional: I agree to before and after measurements to track my results." v={intake.measurement_consent ? "Checked — agreed" : "Not checked"} />
      <div className="py-1 border-b border-border/50 space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Initialed statements</p>
        {BW_ACKNOWLEDGEMENTS.map((a) => (
          <p key={a.key} data-intake-field className="text-sm"><span className="font-semibold mr-1">{intake.acknowledgements?.[a.key] || "Not initialed"}</span>{a.text}</p>
        ))}
      </div>
      <Sig label={`Client: ${intake.signature_name || ""}`} img={intake.signature_image} at={fmt(intake.signed_at)} />
      {intake.guardian_signature_image && (
        <Sig label={`Parent/guardian: ${intake.guardian_name || ""}`} img={intake.guardian_signature_image} at={fmt(intake.guardian_signed_at)} />
      )}
      {intake.practitioner_signed_at ? (
        <p className="text-xs">Practitioner sign-off: <span className="font-medium">{intake.practitioner_name}</span> · {fmt(intake.practitioner_signed_at)}</p>
      ) : staffSignOff ? (
        <div data-intake-no-print className="flex gap-2 items-center">
          <Input placeholder="Practitioner name" value={pName} onChange={(e) => setPName(e.target.value)} className="h-8" />
          <Button
            type="button"
            size="sm"
            disabled={!pName.trim() || sign.isPending}
            onClick={() => sign.mutate({ id: intake.id, appointmentId: intake.appointment_id, name: pName.trim() })}
          >
            Sign off
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Awaiting practitioner sign-off</p>
      )}
    </div>
  );
}

function Row({ q, v }: { q: string; v?: string | null }) {
  return (
    <div data-intake-field className="py-1 border-b border-border/50">
      <p className="text-xs text-muted-foreground font-medium">{q}</p>
      {v ? <p className="whitespace-pre-wrap">{v}</p> : <p className="text-muted-foreground italic">None reported</p>}
    </div>
  );
}

function Sig({ label, img, at }: { label: string; img: string | null; at: string }) {
  return (
    <div data-intake-field className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label} {at && `· ${at}`}</p>
      {img && <img src={img} alt="Signature" className="h-20 rounded border bg-background" />}
    </div>
  );
}
