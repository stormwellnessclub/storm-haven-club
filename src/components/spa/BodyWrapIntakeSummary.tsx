import { useState } from "react";
import { format } from "date-fns";
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
  const yes = BW_HEALTH_QUESTIONS.filter((q) => intake.health_answers?.[q.key]);
  const fmt = (d?: string | null) => (d ? format(new Date(d), "MMM d, yyyy h:mm a") : "");

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
      <div className="py-1 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-medium">Health conditions marked Yes</p>
        {yes.length ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {yes.map((q) => <Badge key={q.key} variant="destructive" className="text-xs">{q.label}</Badge>)}
          </div>
        ) : <p className="text-muted-foreground italic">None reported</p>}
      </div>
      <Row q="Details" v={intake.health_details} />
      <Row q="Other allergies" v={intake.other_allergies} />
      <Row q="Medications" v={intake.medications} />
      <Row q="Goals" v={intake.goals} />
      <Row q="Will eat and hydrate before" v={intake.ate_and_hydrated ? "Yes" : "No"} />
      <Row q="Before/after measurements" v={intake.measurement_consent ? "Agreed" : "Declined"} />
      <div className="py-1 border-b border-border/50 space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Initialed statements</p>
        {BW_ACKNOWLEDGEMENTS.map((a) => (
          <p key={a.key} className="text-xs"><span className="font-semibold mr-1">{intake.acknowledgements?.[a.key] || "—"}</span>{a.text}</p>
        ))}
      </div>
      <Sig label={`Client: ${intake.signature_name || ""}`} img={intake.signature_image} at={fmt(intake.signed_at)} />
      {intake.guardian_signature_image && (
        <Sig label={`Parent/guardian: ${intake.guardian_name || ""}`} img={intake.guardian_signature_image} at={fmt(intake.guardian_signed_at)} />
      )}
      {intake.practitioner_signed_at ? (
        <p className="text-xs">Practitioner sign-off: <span className="font-medium">{intake.practitioner_name}</span> · {fmt(intake.practitioner_signed_at)}</p>
      ) : staffSignOff ? (
        <div className="flex gap-2 items-center">
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
    <div className="py-1 border-b border-border/50">
      <p className="text-xs text-muted-foreground font-medium">{q}</p>
      {v ? <p className="whitespace-pre-wrap">{v}</p> : <p className="text-muted-foreground italic">None reported</p>}
    </div>
  );
}

function Sig({ label, img, at }: { label: string; img: string | null; at: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label} {at && `· ${at}`}</p>
      {img && <img src={img} alt="Signature" className="h-20 rounded border bg-background" />}
    </div>
  );
}
