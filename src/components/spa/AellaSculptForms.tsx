import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SignaturePad } from "@/components/spa/SignaturePad";
import { detroitToday } from "@/lib/spaClientPackages";
import {
  answerChoices, cleanAnswers, firstMissing, isShown, needsDetail, toggleMulti, valuesOf,
  CONSENT_SECTIONS, CONSENT_STATEMENT, CONSENT_VERSION, PHOTO_NO, PHOTO_NOTE, PHOTO_QUESTION, PHOTO_YES, SCREENING_INTRO,
  type Answers, type ScreeningQuestion,
} from "@/lib/aellaSculptForms";
import {
  usePhotoConsent, useSavePhotoConsent, useSaveSculptConsent, useSaveSculptIntake, useScreeningQuestions, useSculptConsent, useSculptIntake,
} from "@/hooks/useAellaSculptForms";

type Part = "intake" | "consent" | "photos";

const pill = (on: boolean) =>
  `border px-4 py-2.5 text-left text-sm transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-foreground/30 hover:border-foreground/70"}`;
const field = "w-full border border-foreground/30 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";
const primary = "inline-flex items-center justify-center gap-2 border border-foreground bg-foreground px-6 py-3 text-xs tracking-[0.25em] uppercase text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Aella Sculpt first-visit forms for one appointment: Health & Treatment Intake, Treatment Consent,
 * and the optional Progress Photography Consent — three separate forms, saved separately.
 */
export function AellaSculptForms({ appointmentId, zoneName, onAllDone }: { appointmentId: string; zoneName?: string | null; onAllDone?: () => void }) {
  const { user } = useAuth();
  const { data: questions = [], isLoading: qLoading } = useScreeningQuestions();
  const intake = useSculptIntake(appointmentId, user?.id);
  const consent = useSculptConsent(appointmentId, user?.id);
  const photo = usePhotoConsent(user?.id);
  const intakeDone = !!intake.data?.latest;
  const consentDone = !!consent.data?.latest;
  const photoDone = photo.data != null;
  const [part, setPart] = useState<Part>("intake");
  const opened = useRef(false);
  const { data: apptZone } = useQuery({
    queryKey: ["sculpt-appt-zone", appointmentId],
    enabled: !zoneName,
    queryFn: async () => ((await (supabase.from as any)("spa_appointments").select("treatment_zone_name").eq("id", appointmentId).maybeSingle()).data?.treatment_zone_name ?? null) as string | null,
  });

  // Open on the first form still to do.
  useEffect(() => {
    if (opened.current || intake.isLoading || consent.isLoading || photo.isLoading) return;
    opened.current = true;
    setPart(!intakeDone ? "intake" : !consentDone ? "consent" : !photoDone ? "photos" : "intake");
  }, [intake.isLoading, consent.isLoading, photo.isLoading, intakeDone, consentDone, photoDone]);

  const tabs: { id: Part; label: string; state: string }[] = [
    { id: "intake", label: "Health & Treatment Intake", state: intakeDone ? "Complete" : "Pending" },
    { id: "consent", label: "Treatment Consent", state: consentDone ? "Complete" : "Pending" },
    { id: "photos", label: "Progress Photography", state: photoDone ? (photo.data!.consent ? "Yes" : "No") : "Optional" },
  ];

  if (!user) return <p className="text-sm text-muted-foreground">Please sign in to complete your forms.</p>;
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Aella Sculpt forms">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={part === t.id} onClick={() => setPart(t.id)} className={pill(part === t.id)}>
            <span className="block">{t.label}</span>
            <span className={`mt-1 flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase ${part === t.id ? "text-background/70" : "text-muted-foreground"}`}>
              {(t.state === "Complete" || t.state === "Yes" || t.state === "No") && <Check className="h-3 w-3" />}{t.state}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-8">
        {part === "intake" && (qLoading || intake.isLoading ? <Loading /> : (
          <IntakePart appointmentId={appointmentId} zoneName={zoneName ?? apptZone ?? null} questions={questions}
            initial={(intake.data?.own ?? intake.data?.latest)?.answers ?? {}} prefilled={!intake.data?.own && !!intake.data?.latest}
            onSaved={() => setPart(consentDone ? (photoDone ? "intake" : "photos") : "consent")} />
        ))}
        {part === "consent" && (consent.isLoading ? <Loading /> : (
          <ConsentPart appointmentId={appointmentId} existing={consent.data?.latest ?? null}
            onSaved={() => { if (!photoDone) setPart("photos"); else if (intakeDone) onAllDone?.(); }} />
        ))}
        {part === "photos" && (
          <PhotoPart appointmentId={appointmentId} current={photo.data?.consent ?? null}
            onSaved={() => { if (intakeDone && consentDone) onAllDone?.(); else setPart(!intakeDone ? "intake" : "consent"); }} />
        )}
      </div>
    </div>
  );
}

const Loading = () => <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>;

function IntakePart({ appointmentId, zoneName, questions, initial, prefilled, onSaved }: {
  appointmentId: string; zoneName: string | null; questions: ScreeningQuestion[]; initial: Answers; prefilled: boolean; onSaved: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const save = useSaveSculptIntake();
  const sections = useMemo(() => {
    const out: { name: string; items: ScreeningQuestion[] }[] = [];
    for (const q of questions) {
      const last = out[out.length - 1];
      if (last && last.name === q.section) last.items.push(q); else out.push({ name: q.section, items: [q] });
    }
    return out;
  }, [questions]);
  const set = (id: string, patch: Partial<{ answer: string | string[] | null; detail: string | null }>) =>
    setAnswers((a) => ({ ...a, [id]: { answer: a[id]?.answer ?? null, detail: a[id]?.detail ?? null, ...patch } }));

  const submit = async () => {
    const missing = firstMissing(questions, answers);
    if (missing) {
      toast.error(`Please answer: ${missing.title ?? missing.prompt}`);
      document.getElementById(`q-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    await save.mutateAsync({ appointmentId, answers: cleanAnswers(questions, answers) });
    onSaved();
  };

  return (
    <div className="space-y-10">
      {prefilled && <p className="text-sm text-muted-foreground">We've filled in your answers from your last intake. Please check them and update anything that has changed.</p>}
      <div>
        <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Which area are we treating today?</p>
        <p className="mt-2 font-serif text-xl">{zoneName ?? "Your selected treatment area"}</p>
      </div>
      {sections.map((s) => (
        <fieldset key={s.name} className="space-y-8">
          <legend className="font-serif text-2xl">{s.name}</legend>
          {s.name === "Health screening" && <p className="text-sm leading-relaxed text-muted-foreground">{SCREENING_INTRO}</p>}
          {s.items.filter((q) => isShown(q, answers)).map((q) => (
            <QuestionField key={q.id} q={q} value={answers[q.id]} answers={answers} onChange={(p) => set(q.id, p)} />
          ))}
        </fieldset>
      ))}
      <button type="button" className={primary} disabled={save.isPending} onClick={submit}>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save intake
      </button>
    </div>
  );
}

function QuestionField({ q, value, answers, onChange }: {
  q: ScreeningQuestion; value: Answers[string] | undefined; answers: Answers;
  onChange: (p: Partial<{ answer: string | string[] | null; detail: string | null }>) => void;
}) {
  const vals = valuesOf(value);
  const choices = answerChoices(q);
  return (
    <div id={`q-${q.id}`} className={q.parent_id ? "border-l border-foreground/20 pl-5" : ""}>
      {q.title && <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">{q.title}</p>}
      <p className="mt-2 text-sm leading-relaxed">{q.prompt}{!q.is_required && <span className="text-muted-foreground"> (optional)</span>}</p>
      {q.answer_type === "text" ? (
        <textarea rows={3} maxLength={2000} className={`${field} mt-3`} value={(value?.answer as string) ?? ""} onChange={(e) => onChange({ answer: e.target.value })} />
      ) : q.answer_type === "multi" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={q.prompt}>
          {choices.map((c) => (
            <button key={c.value} type="button" aria-pressed={vals.includes(c.value)} className={pill(vals.includes(c.value))}
              onClick={() => onChange({ answer: toggleMulti(q, vals, c.value) })}>{c.label}</button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={q.prompt}>
          {choices.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={vals[0] === c.value} className={`${pill(vals[0] === c.value)} min-w-24 text-center`}
              onClick={() => onChange({ answer: c.value })}>{c.label}</button>
          ))}
        </div>
      )}
      {needsDetail(q, answers) && (
        <div className="mt-4">
          <label className="text-xs text-muted-foreground" htmlFor={`d-${q.id}`}>{q.detail_prompt}</label>
          <textarea id={`d-${q.id}`} rows={2} maxLength={1000} className={`${field} mt-2`} value={value?.detail ?? ""} onChange={(e) => onChange({ detail: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function ConsentPart({ appointmentId, existing, onSaved }: {
  appointmentId: string; existing: { printed_name: string; signed_on: string; appointment_id: string } | null; onSaved: () => void;
}) {
  const [resign, setResign] = useState(false);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const save = useSaveSculptConsent();
  const today = detroitToday();

  if (existing && !resign) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Signed by {existing.printed_name} on {format(parseISO(existing.signed_on), "MMMM d, yyyy")}.</p>
        <button type="button" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase hover:border-foreground" onClick={() => setResign(true)}>Read and sign again</button>
      </div>
    );
  }
  const allAck = CONSENT_SECTIONS.every((s) => acks[s.key]);
  const submit = async () => {
    if (!allAck) { toast.error("Please acknowledge each section"); return; }
    if (!agreed) { toast.error("Please check the consent box"); return; }
    if (!sig) { toast.error("Please sign in the box"); return; }
    if (name.trim().length < 2) { toast.error("Please print your name"); return; }
    await save.mutateAsync({ appointmentId, acknowledgements: acks, printedName: name, signature: sig, signedOn: today, version: CONSENT_VERSION });
    setResign(false);
    onSaved();
  };
  return (
    <div className="space-y-8">
      <h3 className="font-serif text-2xl">Aella Sculpt Informed Consent</h3>
      <p className="text-sm text-muted-foreground">Please read and acknowledge each section before signing.</p>
      {CONSENT_SECTIONS.map((s) => (
        <section key={s.key} className="border-t border-foreground/15 pt-6">
          <h4 className="font-serif text-xl">{s.title}</h4>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.intro && <p>{s.intro}</p>}
            {s.bullets && <ul className="list-disc space-y-1 pl-5">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            {s.after?.map((p) => <p key={p}>{p}</p>)}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-current" checked={!!acks[s.key]} onChange={(e) => setAcks((a) => ({ ...a, [s.key]: e.target.checked }))} />
            I acknowledge this section
          </label>
        </section>
      ))}
      <section className="border-t border-foreground/15 pt-6 space-y-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-current" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          {CONSENT_STATEMENT}
        </label>
        <div className="signature-light max-w-lg"><SignaturePad value={sig} onChange={setSig} label="Client electronic signature" /></div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="consent-name">Printed name</label>
            <input id="consent-name" className={`${field} mt-2`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="mt-2 py-2.5 text-sm">{format(parseISO(today), "MMMM d, yyyy")}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Your provider adds their acknowledgement at your visit.</p>
        <button type="button" className={primary} disabled={save.isPending} onClick={submit}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Sign consent
        </button>
      </section>
    </div>
  );
}

function PhotoPart({ appointmentId, current, onSaved }: { appointmentId: string; current: boolean | null; onSaved: () => void }) {
  const [choice, setChoice] = useState<boolean | null>(current);
  const save = useSavePhotoConsent();
  useEffect(() => setChoice(current), [current]);
  return (
    <div className="space-y-6">
      <h3 className="font-serif text-2xl">Progress Photography Consent</h3>
      <p className="text-sm text-muted-foreground">This is optional and separate from your treatment consent.</p>
      <p className="text-sm leading-relaxed">{PHOTO_QUESTION}</p>
      <div className="grid gap-2" role="radiogroup" aria-label="Progress photography">
        <button type="button" role="radio" aria-checked={choice === true} className={pill(choice === true)} onClick={() => setChoice(true)}>{PHOTO_YES}</button>
        <button type="button" role="radio" aria-checked={choice === false} className={pill(choice === false)} onClick={() => setChoice(false)}>{PHOTO_NO}</button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{PHOTO_NOTE}</p>
      <button type="button" className={primary} disabled={choice === null || save.isPending}
        onClick={async () => { await save.mutateAsync({ consent: choice!, appointmentId }); onSaved(); }}>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save choice
      </button>
    </div>
  );
}
