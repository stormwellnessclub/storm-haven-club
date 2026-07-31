import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format as fmtDate, parseISO } from "date-fns";
import { ArrowLeft, Mail, Phone, Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PT_FORMAT_LABEL, formatCents } from "@/lib/ptFormat";
import {
  PTShell, PTPageHeader, PTCard, PTStatus, PTEmpty, ptButtonClass, PTKpiCard, PTSectionTitle,
} from "@/components/admin/pt/PTUI";
import {
  usePTPeople, usePTTrainers, usePTTrainerMap, usePTClientProfile, useSavePTClientProfile,
} from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";

const TABS = ["Overview", "Sessions", "Programs", "Notes", "Measurements", "Billing"] as const;
type Tab = typeof TABS[number];

export default function PTClientDetail() {
  const { userId = "" } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [bookOpen, setBookOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const { data: people = {} } = usePTPeople([userId]);
  const person = people[userId];
  const { data: profile } = usePTClientProfile(userId);
  const saveProfile = useSavePTClientProfile(userId);
  const { data: trainers = [] } = usePTTrainers();
  const trainerMap = usePTTrainerMap();

  const { data: appts = [] } = useQuery({
    queryKey: ["pt-client-appts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments").select("*").eq("user_id", userId).order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: passes = [] } = useQuery({
    queryKey: ["pt-client-passes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes").select("*").eq("user_id", userId).order("activated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const nowIso = new Date().toISOString();
  const upcoming = appts.filter((a: any) => a.status === "scheduled" && a.starts_at >= nowIso).reverse();
  const past = appts.filter((a: any) => !(a.status === "scheduled" && a.starts_at >= nowIso));
  const remaining = passes.filter((p: any) => p.status === "active").reduce((s: number, p: any) => s + p.sessions_remaining, 0);
  const completed = appts.filter((a: any) => a.status === "completed").length;
  const owed = appts.filter((a: any) => a.payment_status === "unpaid").reduce((s: number, a: any) => s + (a.amount_due_cents || 0), 0);
  const attendance = useMemo(() => {
    const relevant = appts.filter((a: any) => ["completed", "no_show", "late_cancel"].includes(a.status));
    if (!relevant.length) return null;
    return Math.round((relevant.filter((a: any) => a.status === "completed").length / relevant.length) * 100);
  }, [appts]);

  return (
    <PTShell>
      <Link to="/admin/pt/clients" className="inline-flex items-center gap-1 text-xs text-pt-muted hover:text-pt-ink mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      <PTPageHeader
        eyebrow={person?.isMember ? "Member · Personal Training" : "Non-member · Personal Training"}
        title={person?.name ?? "Client"}
        subtitle={[person?.email, person?.phone].filter(Boolean).join("  ·  ")}
        actions={
          <>
            {person?.email && (
              <a className={ptButtonClass("outline")} href={`mailto:${person.email}`}><Mail className="h-4 w-4" /> Email</a>
            )}
            {person?.phone && (
              <a className={ptButtonClass("outline")} href={`tel:${person.phone}`}><Phone className="h-4 w-4" /> Call</a>
            )}
            <button className={ptButtonClass("outline")} onClick={() => setSellOpen(true)}>Sell package</button>
            <button className={ptButtonClass()} onClick={() => setBookOpen(true)}><Plus className="h-4 w-4" /> Book session</button>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <PTKpiCard label="Sessions remaining" value={remaining} tone={remaining <= 2 ? "amber" : "gold"} />
        <PTKpiCard label="Sessions completed" value={completed} tone="green" />
        <PTKpiCard label="Attendance" value={attendance === null ? "—" : `${attendance}%`} hint="Completed vs missed" />
        <PTKpiCard label="Balance owed" value={formatCents(owed)} tone={owed > 0 ? "red" : "green"} />
      </div>

      <div className="flex gap-1 border-b border-pt-line mb-5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] border-b-2 whitespace-nowrap ${
              tab === t ? "border-pt-gold text-pt-ink font-medium" : "border-transparent text-pt-muted hover:text-pt-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProfileEditor profile={profile} trainers={trainers} onSave={(v) => saveProfile.mutate(v)} />
          <div className="space-y-5">
            <div>
              <PTSectionTitle>Upcoming sessions</PTSectionTitle>
              <PTCard className="p-0">
                {upcoming.length === 0 ? <div className="p-4"><PTEmpty>Nothing booked.</PTEmpty></div> : (
                  <ul className="divide-y divide-pt-line/70">
                    {upcoming.slice(0, 5).map((a: any) => (
                      <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px]">{fmtDate(parseISO(a.starts_at), "EEE, MMM d · h:mm a")}</div>
                          <div className="text-[11px] text-pt-muted">
                            {PT_FORMAT_LABEL[a.format]}{a.instructor_id ? ` · ${trainerMap[a.instructor_id] ?? ""}` : ""}
                          </div>
                        </div>
                        <PTStatus status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </PTCard>
            </div>
            <div>
              <PTSectionTitle>Active packages</PTSectionTitle>
              <PTCard className="p-0">
                {passes.filter((p: any) => p.status === "active").length === 0 ? (
                  <div className="p-4"><PTEmpty>No active package.</PTEmpty></div>
                ) : (
                  <ul className="divide-y divide-pt-line/70">
                    {passes.filter((p: any) => p.status === "active").map((p: any) => (
                      <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px]">{p.pack_name}</div>
                          <div className="text-[11px] text-pt-muted">
                            {PT_FORMAT_LABEL[p.format]} · expires {fmtDate(parseISO(p.expires_at), "MMM d, yyyy")}
                          </div>
                        </div>
                        <span className="text-[13px] font-medium">{p.sessions_remaining}/{p.sessions_total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PTCard>
            </div>
          </div>
        </div>
      )}

      {tab === "Sessions" && (
        <PTCard className="p-0 overflow-hidden">
          {appts.length === 0 ? <div className="p-6"><PTEmpty>No sessions yet.</PTEmpty></div> : (
            <ul className="divide-y divide-pt-line/70">
              {appts.map((a: any) => (
                <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{fmtDate(parseISO(a.starts_at), "EEE, MMM d yyyy · h:mm a")}</div>
                    <div className="text-[11px] text-pt-muted">
                      {PT_FORMAT_LABEL[a.format]} · {a.duration_minutes} min
                      {a.instructor_id ? ` · ${trainerMap[a.instructor_id] ?? ""}` : ""}
                    </div>
                    {a.notes && <div className="text-[11px] text-pt-muted italic">{a.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <PTStatus status={a.status} />
                    {a.payment_status && <PTStatus status={a.payment_status} />}
                    {a.payment_status === "unpaid" && (
                      <Link className={ptButtonClass("outline")} to="/admin/personal-training/payments">Collect</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PTCard>
      )}

      {tab === "Programs" && <ClientPrograms userId={userId} />}
      {tab === "Notes" && <SessionNotes userId={userId} appts={appts} />}
      {tab === "Measurements" && <Measurements userId={userId} />}

      {tab === "Billing" && (
        <PTCard className="p-0 overflow-hidden">
          {passes.length === 0 ? <div className="p-6"><PTEmpty>No purchases yet.</PTEmpty></div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-pt-line/70 bg-pt-beige/25">
                  {["Package", "Format", "Sessions", "Paid", "Purchased", "Expires", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 pt-eyebrow font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-pt-line/60">
                {passes.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.pack_name}</td>
                    <td className="px-4 py-3 text-pt-muted">{PT_FORMAT_LABEL[p.format]}</td>
                    <td className="px-4 py-3">{p.sessions_remaining}/{p.sessions_total}</td>
                    <td className="px-4 py-3">{formatCents(p.price_cents_charged)}</td>
                    <td className="px-4 py-3 text-pt-muted">{fmtDate(parseISO(p.activated_at), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-pt-muted">{fmtDate(parseISO(p.expires_at), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3"><PTStatus status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PTCard>
      )}

      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        presetUserId={userId}
        presetUserName={person?.name}
        onSellPack={() => { setBookOpen(false); setSellOpen(true); }}
        onBooked={() => qc.invalidateQueries({ queryKey: ["pt-client-appts", userId] })}
      />
      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} presetUserId={userId} presetUserName={person?.name} />
    </PTShell>
  );
}

function ProfileEditor({ profile, trainers, onSave }: { profile: any; trainers: { id: string; name: string }[]; onSave: (v: any) => void }) {
  const [goals, setGoals] = useState<string>((profile?.goals ?? []).join(", "));
  const [restrictions, setRestrictions] = useState<string>((profile?.restrictions ?? []).join(", "));
  const [notes, setNotes] = useState<string>(profile?.internal_notes ?? "");
  const [trainer, setTrainer] = useState<string>(profile?.primary_trainer_id ?? "none");
  const [dob, setDob] = useState<string>(profile?.date_of_birth ?? "");

  return (
    <div>
      <PTSectionTitle>Coaching profile</PTSectionTitle>
      <PTCard className="space-y-3">
        <div>
          <label className="pt-eyebrow">Primary trainer</label>
          <Select value={trainer} onValueChange={setTrainer}>
            <SelectTrigger className="mt-1 bg-white border-pt-line"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="pt-eyebrow">Date of birth</label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 bg-white border-pt-line" />
        </div>
        <div>
          <label className="pt-eyebrow">Goals (comma separated)</label>
          <Input value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Fat loss, posture, strength"
            className="mt-1 bg-white border-pt-line" />
        </div>
        <div>
          <label className="pt-eyebrow">Restrictions / injuries</label>
          <Input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="Left shoulder, low back"
            className="mt-1 bg-white border-pt-line" />
        </div>
        <div>
          <label className="pt-eyebrow">Internal notes</label>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-white border-pt-line" />
        </div>
        <button
          className={ptButtonClass()}
          onClick={() => onSave({
            primary_trainer_id: trainer === "none" ? null : trainer,
            date_of_birth: dob || null,
            goals: goals.split(",").map((g) => g.trim()).filter(Boolean),
            restrictions: restrictions.split(",").map((g) => g.trim()).filter(Boolean),
            internal_notes: notes || null,
          })}
        >
          <Save className="h-4 w-4" /> Save profile
        </button>
      </PTCard>
    </div>
  );
}

function SessionNotes({ userId, appts }: { userId: string; appts: any[] }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ subjective: "", objective: "", homework: "", next_focus: "", rpe: "" });
  const [apptId, setApptId] = useState<string>("none");

  const { data: notes = [] } = useQuery({
    queryKey: ["pt-session-notes", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_session_notes").select("*").eq("user_id", userId).order("session_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    if (!draft.subjective && !draft.objective && !draft.homework) return toast.error("Write something first");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("pt_session_notes").insert({
      user_id: userId,
      appointment_id: apptId === "none" ? null : apptId,
      subjective: draft.subjective || null,
      objective: draft.objective || null,
      homework: draft.homework || null,
      next_focus: draft.next_focus || null,
      rpe: draft.rpe ? Number(draft.rpe) : null,
      is_draft: false,
      created_by: auth?.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Note saved");
    setDraft({ subjective: "", objective: "", homework: "", next_focus: "", rpe: "" });
    qc.invalidateQueries({ queryKey: ["pt-session-notes", userId] });
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("pt_session_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-session-notes", userId] });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div>
        <PTSectionTitle>New session note</PTSectionTitle>
        <PTCard className="space-y-3">
          <Select value={apptId} onValueChange={setApptId}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue placeholder="Link to a session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No linked session</SelectItem>
              {appts.slice(0, 25).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{fmtDate(parseISO(a.starts_at), "MMM d, yyyy h:mm a")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={3} placeholder="How the client felt (subjective)" value={draft.subjective}
            onChange={(e) => setDraft({ ...draft, subjective: e.target.value })} className="bg-white border-pt-line" />
          <Textarea rows={3} placeholder="What we did (objective)" value={draft.objective}
            onChange={(e) => setDraft({ ...draft, objective: e.target.value })} className="bg-white border-pt-line" />
          <Input placeholder="Homework" value={draft.homework}
            onChange={(e) => setDraft({ ...draft, homework: e.target.value })} className="bg-white border-pt-line" />
          <Input placeholder="Next session focus" value={draft.next_focus}
            onChange={(e) => setDraft({ ...draft, next_focus: e.target.value })} className="bg-white border-pt-line" />
          <Input type="number" min={1} max={10} step="0.5" placeholder="RPE (1-10)" value={draft.rpe}
            onChange={(e) => setDraft({ ...draft, rpe: e.target.value })} className="bg-white border-pt-line" />
          <button className={ptButtonClass()} onClick={save}><Save className="h-4 w-4" /> Save note</button>
        </PTCard>
      </div>
      <div>
        <PTSectionTitle>History</PTSectionTitle>
        {notes.length === 0 ? <PTEmpty>No notes yet.</PTEmpty> : (
          <div className="space-y-3">
            {notes.map((n: any) => (
              <PTCard key={n.id} className="relative">
                <button className="absolute top-3 right-3 text-pt-muted hover:text-pt-red" onClick={() => remove(n.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="pt-eyebrow mb-2">{fmtDate(parseISO(n.session_date), "EEEE, MMMM d yyyy")}</div>
                {n.subjective && <p className="text-[13px] mb-1"><span className="text-pt-muted">Felt:</span> {n.subjective}</p>}
                {n.objective && <p className="text-[13px] mb-1"><span className="text-pt-muted">Did:</span> {n.objective}</p>}
                {n.homework && <p className="text-[13px] mb-1"><span className="text-pt-muted">Homework:</span> {n.homework}</p>}
                {n.next_focus && <p className="text-[13px] mb-1"><span className="text-pt-muted">Next:</span> {n.next_focus}</p>}
                {n.rpe && <p className="text-[13px] text-pt-muted">RPE {n.rpe}</p>}
              </PTCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Measurements({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [pr, setPr] = useState({ exercise: "", weight_lbs: "", reps: "" });

  const { data: metrics = [] } = useQuery({
    queryKey: ["pt-body-metrics", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_body_metrics").select("*").eq("user_id", userId).order("measured_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: prs = [] } = useQuery({
    queryKey: ["pt-prs", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_prs").select("*").eq("user_id", userId).order("achieved_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fields = [
    ["weight_lbs", "Weight (lbs)"], ["body_fat_pct", "Body fat %"], ["muscle_mass_lbs", "Muscle mass (lbs)"],
    ["waist_in", "Waist (in)"], ["chest_in", "Chest (in)"], ["hips_in", "Hips (in)"],
    ["arms_in", "Arms (in)"], ["thighs_in", "Thighs (in)"],
  ] as const;

  async function saveMetrics() {
    const payload: Record<string, any> = { user_id: userId };
    let any = false;
    fields.forEach(([k]) => { if (form[k]) { payload[k] = Number(form[k]); any = true; } });
    if (!any) return toast.error("Enter at least one measurement");
    if (form.measured_on) payload.measured_on = form.measured_on;
    const { data: auth } = await supabase.auth.getUser();
    payload.created_by = auth?.user?.id ?? null;
    const { error } = await (supabase as any).from("pt_body_metrics").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Measurements recorded");
    setForm({});
    qc.invalidateQueries({ queryKey: ["pt-body-metrics", userId] });
  }

  async function savePr() {
    if (!pr.exercise.trim()) return toast.error("Name the exercise");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("pt_prs").insert({
      user_id: userId,
      exercise: pr.exercise.trim(),
      weight_lbs: pr.weight_lbs ? Number(pr.weight_lbs) : null,
      reps: pr.reps ? Number(pr.reps) : null,
      created_by: auth?.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("PR logged");
    setPr({ exercise: "", weight_lbs: "", reps: "" });
    qc.invalidateQueries({ queryKey: ["pt-prs", userId] });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div>
          <PTSectionTitle>Record measurements</PTSectionTitle>
          <PTCard className="space-y-2">
            <Input type="date" value={form.measured_on ?? ""} onChange={(e) => setForm({ ...form, measured_on: e.target.value })}
              className="bg-white border-pt-line" />
            <div className="grid grid-cols-2 gap-2">
              {fields.map(([k, label]) => (
                <Input key={k} type="number" step="0.1" placeholder={label} value={form[k] ?? ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="bg-white border-pt-line" />
              ))}
            </div>
            <button className={ptButtonClass()} onClick={saveMetrics}><Save className="h-4 w-4" /> Save</button>
          </PTCard>
        </div>
        <div>
          <PTSectionTitle>Log a PR</PTSectionTitle>
          <PTCard className="space-y-2">
            <Input placeholder="Exercise" value={pr.exercise} onChange={(e) => setPr({ ...pr, exercise: e.target.value })}
              className="bg-white border-pt-line" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Weight (lbs)" value={pr.weight_lbs}
                onChange={(e) => setPr({ ...pr, weight_lbs: e.target.value })} className="bg-white border-pt-line" />
              <Input type="number" placeholder="Reps" value={pr.reps}
                onChange={(e) => setPr({ ...pr, reps: e.target.value })} className="bg-white border-pt-line" />
            </div>
            <button className={ptButtonClass()} onClick={savePr}><Plus className="h-4 w-4" /> Add PR</button>
          </PTCard>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <PTSectionTitle>Measurement history</PTSectionTitle>
          <PTCard className="p-0 overflow-x-auto pt-scroll">
            {metrics.length === 0 ? <div className="p-4"><PTEmpty>Nothing recorded.</PTEmpty></div> : (
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left border-b border-pt-line/70 bg-pt-beige/25">
                    {["Date", "Weight", "BF%", "Waist", "Chest", "Arms"].map((h) => (
                      <th key={h} className="px-3 py-2 pt-eyebrow font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pt-line/60">
                  {metrics.map((m: any) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">{fmtDate(parseISO(m.measured_on), "MMM d, yyyy")}</td>
                      <td className="px-3 py-2">{m.weight_lbs ?? "—"}</td>
                      <td className="px-3 py-2">{m.body_fat_pct ?? "—"}</td>
                      <td className="px-3 py-2">{m.waist_in ?? "—"}</td>
                      <td className="px-3 py-2">{m.chest_in ?? "—"}</td>
                      <td className="px-3 py-2">{m.arms_in ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PTCard>
        </div>
        <div>
          <PTSectionTitle>Personal records</PTSectionTitle>
          <PTCard className="p-0">
            {prs.length === 0 ? <div className="p-4"><PTEmpty>No PRs logged.</PTEmpty></div> : (
              <ul className="divide-y divide-pt-line/70">
                {prs.map((p: any) => (
                  <li key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[13px]">{p.exercise}</span>
                    <span className="text-[13px] text-pt-muted">
                      {p.weight_lbs ? `${p.weight_lbs} lb` : ""}{p.reps ? ` × ${p.reps}` : ""} · {fmtDate(parseISO(p.achieved_on), "MMM d")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PTCard>
        </div>
      </div>
    </div>
  );
}

function ClientPrograms({ userId }: { userId: string }) {
  const { data: programs = [] } = useQuery({
    queryKey: ["pt-programs", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_programs").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PTSectionTitle action={<Link className="text-xs text-pt-gold hover:underline" to={`/admin/pt/programs?client=${userId}`}>Open builder →</Link>}>
        Programs
      </PTSectionTitle>
      {programs.length === 0 ? (
        <PTEmpty>
          No program yet. <Link className="text-pt-gold hover:underline" to={`/admin/pt/programs?client=${userId}`}>Build one →</Link>
        </PTEmpty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {programs.map((p: any) => (
            <PTCard key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="pt-serif text-xl">{p.name}</div>
                  <div className="text-xs text-pt-muted">{p.goal ?? "No goal set"}</div>
                </div>
                <PTStatus status={p.status} />
              </div>
              <div className="text-xs text-pt-muted mt-3">
                {p.length_weeks ? `${p.length_weeks} weeks · ` : ""}
                {p.sessions_per_week ? `${p.sessions_per_week}×/week` : ""}
              </div>
              <Link className={`${ptButtonClass("outline")} mt-3`} to={`/admin/pt/programs?program=${p.id}`}>Open</Link>
            </PTCard>
          ))}
        </div>
      )}
    </div>
  );
}
