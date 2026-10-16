import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "./SignaturePad";
import {
  BW_ACKNOWLEDGEMENTS,
  BW_HEALTH_QUESTIONS,
  type BodyWrapIntake,
  type BodyWrapIntakeInput,
  isUnder18,
} from "@/hooks/useBodyWrapIntake";

interface Props {
  appointmentId: string;
  memberId?: string | null;
  initial?: BodyWrapIntake | null;
  isSubmitting: boolean;
  onSubmit: (v: BodyWrapIntakeInput) => Promise<void>;
}

export function BodyWrapIntakeForm({ appointmentId, memberId, initial, isSubmitting, onSubmit }: Props) {
  const { user } = useAuth();
  const { data: prof } = useQuery({
    queryKey: ["bw-intake-prefill", user?.id],
    enabled: !!user && !initial,
    queryFn: async () => {
      const [{ data: p }, { data: n }] = await Promise.all([
        (supabase.from as any)("profiles").select("*").eq("id", user!.id).maybeSingle(),
        (supabase.from as any)("non_member_profiles").select("first_name,last_name,phone,email").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { p, n };
    },
  });

  const [fullName, setFullName] = useState(initial?.full_name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [dob, setDob] = useState(initial?.date_of_birth || "");
  const [ecName, setEcName] = useState(initial?.emergency_contact_name || "");
  const [ecPhone, setEcPhone] = useState(initial?.emergency_contact_phone || "");
  const [answers, setAnswers] = useState<Record<string, boolean>>(initial?.health_answers || {});
  const [details, setDetails] = useState(initial?.health_details || "");
  const [allergies, setAllergies] = useState(initial?.other_allergies || "");
  const [meds, setMeds] = useState(initial?.medications || "");
  const [goals, setGoals] = useState(initial?.goals || "");
  const [hydrated, setHydrated] = useState<boolean>(initial?.ate_and_hydrated ?? false);
  const [acks, setAcks] = useState<Record<string, string>>(initial?.acknowledgements || {});
  const [measure, setMeasure] = useState(initial?.measurement_consent ?? false);
  const [sigName, setSigName] = useState(initial?.signature_name || "");
  const [sig, setSig] = useState<string | null>(initial?.signature_image || null);
  const [gName, setGName] = useState(initial?.guardian_name || "");
  const [gSig, setGSig] = useState<string | null>(initial?.guardian_signature_image || null);

  useEffect(() => {
    if (initial || !prof) return;
    const p = prof.p || {};
    const n = prof.n || {};
    const name = [p.first_name || n.first_name, p.last_name || n.last_name].filter(Boolean).join(" ");
    setFullName((v) => v || name);
    setEmail((v) => v || p.email || n.email || user?.email || "");
    setPhone((v) => v || p.phone || n.phone || "");
    setAddress((v) => v || [p.address_line1, p.address_line2, p.city, p.state, p.zip_code || p.postal_code].filter(Boolean).join(", "));
    setDob((v) => v || p.date_of_birth || "");
    setEcName((v) => v || p.emergency_contact_name || "");
    setEcPhone((v) => v || p.emergency_contact_phone || "");
  }, [prof, initial, user]);

  const minor = isUnder18(dob);
  const yesItems = BW_HEALTH_QUESTIONS.filter((q) => answers[q.key]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!fullName.trim()) missing.push("your name");
    if (!dob) missing.push("date of birth");
    if (!ecName.trim() || ecPhone.replace(/\D/g, "").length < 10) missing.push("an emergency contact with phone");
    if (BW_HEALTH_QUESTIONS.some((q) => answers[q.key] === undefined)) missing.push("a Yes or No for every health question");
    if (yesItems.length > 0 && !details.trim()) missing.push("details for the items you marked Yes");
    if (BW_ACKNOWLEDGEMENTS.some((a) => !(acks[a.key] || "").trim())) missing.push("your initials on every statement");
    if (!sigName.trim() || !sig) missing.push("your signature");
    if (minor && (!gName.trim() || !gSig)) missing.push("a parent/guardian signature");
    if (missing.length) {
      toast.error(`Please add ${missing.join(", ")}.`);
      return;
    }
    await onSubmit({
      appointment_id: appointmentId,
      member_id: memberId || null,
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      date_of_birth: dob || null,
      emergency_contact_name: ecName.trim(),
      emergency_contact_phone: ecPhone.trim(),
      health_answers: answers,
      health_details: details.trim() || null,
      other_allergies: allergies.trim() || null,
      medications: meds.trim() || null,
      goals: goals.trim() || null,
      ate_and_hydrated: hydrated,
      acknowledgements: acks,
      measurement_consent: measure,
      signature_name: sigName.trim(),
      signature_image: sig,
      guardian_name: minor ? gName.trim() : null,
      guardian_signature_image: minor ? gSig : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium">Your information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Date of birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label>Address, city, state, zip</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Emergency contact name</Label><Input value={ecName} onChange={(e) => setEcName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Emergency contact phone</Label><Input type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Health history</h3>
        <p className="text-xs text-muted-foreground">Do you have, are you, or have you had any of the following?</p>
        <div className="divide-y rounded-md border">
          {BW_HEALTH_QUESTIONS.map((q) => (
            <div key={q.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm">{q.label}</span>
              <div className="flex gap-1 shrink-0">
                {[true, false].map((v) => (
                  <Button
                    key={String(v)}
                    type="button"
                    size="sm"
                    variant={answers[q.key] === v ? (v ? "destructive" : "default") : "outline"}
                    onClick={() => setAnswers((a) => ({ ...a, [q.key]: v }))}
                  >
                    {v ? "Yes" : "No"}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label>
            Tell us more about anything you marked Yes, or any other health condition that could affect your service
            {yesItems.length > 0 && <span className="text-destructive"> *</span>}
          </Label>
          <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div className="space-y-1"><Label>Any other allergies?</Label><Input value={allergies} onChange={(e) => setAllergies(e.target.value)} /></div>
        <div className="space-y-1"><Label>Current medications</Label><Input value={meds} onChange={(e) => setMeds(e.target.value)} /></div>
        <div className="space-y-1"><Label>What personal goals are you hoping to reach with your body wrap?</Label><Textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Before your session</h3>
        <p className="text-sm text-muted-foreground">Please eat a light meal, drink plenty of water before your wrap, and arrive 10 minutes early.</p>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={hydrated} onCheckedChange={(v) => setHydrated(v === true)} />
          I will eat a light meal and be well hydrated before my session.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={measure} onCheckedChange={(v) => setMeasure(v === true)} />
          Optional: I agree to before and after measurements to track my results.
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Please initial each statement</h3>
        {BW_ACKNOWLEDGEMENTS.map((a) => (
          <div key={a.key} className="flex gap-3 items-start">
            <Input
              aria-label="Initials"
              className="w-16 shrink-0 text-center uppercase"
              maxLength={4}
              placeholder="Initials"
              value={acks[a.key] || ""}
              onChange={(e) => setAcks((s) => ({ ...s, [a.key]: e.target.value.toUpperCase() }))}
            />
            <p className="text-sm">{a.text}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Informed consent</h3>
        <div className="space-y-1"><Label>Type your full name</Label><Input value={sigName} onChange={(e) => setSigName(e.target.value)} /></div>
        <SignaturePad value={sig} onChange={setSig} label="Client signature" />
        {minor && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Parent / guardian (required for clients under 18)</p>
            <div className="space-y-1"><Label>Parent / guardian full name</Label><Input value={gName} onChange={(e) => setGName(e.target.value)} /></div>
            <SignaturePad value={gSig} onChange={setGSig} label="Parent / guardian signature" />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Today's date and time are recorded when you submit.</p>
      </section>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {initial ? "Update Body Wrap Intake" : "Sign & Submit Body Wrap Intake"}
      </Button>
    </form>
  );
}
