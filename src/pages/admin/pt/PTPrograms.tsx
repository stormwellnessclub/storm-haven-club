import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTShell, PTPageHeader, PTCard, PTEmpty, PTSectionTitle, ptButtonClass, PTStatus } from "@/components/admin/pt/PTUI";
import { usePTClients, usePTPeople, usePTTrainers } from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PTPrograms() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const clientParam = params.get("client") ?? undefined;
  const programParam = params.get("program") ?? undefined;
  const [selected, setSelected] = useState<string | undefined>(programParam);

  const { data: clientData } = usePTClients();
  const { data: people = {} } = usePTPeople(clientData?.ids ?? []);
  const { data: trainers = [] } = usePTTrainers();

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["pt-programs-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_programs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selected && programs.length) setSelected(programs[0].id);
  }, [programs, selected]);

  const current = programs.find((p: any) => p.id === selected);

  async function createProgram() {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).from("pt_programs").insert({
      name: "New program",
      user_id: clientParam ?? null,
      status: "active",
      created_by: auth?.user?.id ?? null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Program created");
    qc.invalidateQueries({ queryKey: ["pt-programs-all"] });
    setSelected(data.id);
    setParams({ program: data.id });
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title="Programs & Progress"
        subtitle="Build training blocks, order the work, and assign them to clients."
        actions={<button className={ptButtonClass()} onClick={createProgram}><Plus className="h-4 w-4" /> New program</button>}
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div>
          <PTSectionTitle>Programs</PTSectionTitle>
          <PTCard className="p-0">
            {isLoading ? <div className="p-4 text-sm text-pt-muted">Loading…</div>
              : programs.length === 0 ? <div className="p-4"><PTEmpty>No programs yet.</PTEmpty></div> : (
              <ul className="divide-y divide-pt-line/70 max-h-[70vh] overflow-y-auto pt-scroll">
                {programs.map((p: any) => (
                  <li key={p.id}>
                    <button
                      onClick={() => { setSelected(p.id); setParams({ program: p.id }); }}
                      className={`w-full text-left px-4 py-3 hover:bg-pt-beige/40 ${selected === p.id ? "bg-pt-beige/60" : ""}`}
                    >
                      <div className="text-[13px] font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-pt-muted truncate">
                        {p.is_template ? "Template" : p.user_id ? people[p.user_id]?.name ?? "Client" : "Unassigned"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PTCard>
        </div>

        {current ? (
          <ProgramEditor
            key={current.id}
            program={current}
            clients={(clientData?.ids ?? []).map((id) => ({ id, name: people[id]?.name ?? id.slice(0, 8) }))}
            trainers={trainers}
            onChanged={() => qc.invalidateQueries({ queryKey: ["pt-programs-all"] })}
            onDeleted={() => { setSelected(undefined); qc.invalidateQueries({ queryKey: ["pt-programs-all"] }); }}
          />
        ) : (
          <PTEmpty>Select or create a program.</PTEmpty>
        )}
      </div>
    </PTShell>
  );
}

function ProgramEditor({
  program, clients, trainers, onChanged, onDeleted,
}: {
  program: any;
  clients: { id: string; name: string }[];
  trainers: { id: string; name: string }[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [meta, setMeta] = useState({
    name: program.name ?? "",
    goal: program.goal ?? "",
    length_weeks: program.length_weeks?.toString() ?? "",
    sessions_per_week: program.sessions_per_week?.toString() ?? "",
    focus_today: program.focus_today ?? "",
    user_id: program.user_id ?? "none",
    instructor_id: program.instructor_id ?? "none",
    status: program.status ?? "active",
    is_template: !!program.is_template,
  });

  const { data: days = [] } = useQuery({
    queryKey: ["pt-program-days", program.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_program_days").select("*").eq("program_id", program.id).order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dayIds = useMemo(() => days.map((d: any) => d.id), [days]);
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-program-exercises", dayIds],
    enabled: dayIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_program_exercises").select("*").in("day_id", dayIds).order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshDays = () => {
    qc.invalidateQueries({ queryKey: ["pt-program-days", program.id] });
    qc.invalidateQueries({ queryKey: ["pt-program-exercises"] });
  };

  async function saveMeta() {
    const { error } = await (supabase as any).from("pt_programs").update({
      name: meta.name,
      goal: meta.goal || null,
      length_weeks: meta.length_weeks ? Number(meta.length_weeks) : null,
      sessions_per_week: meta.sessions_per_week ? Number(meta.sessions_per_week) : null,
      focus_today: meta.focus_today || null,
      user_id: meta.user_id === "none" ? null : meta.user_id,
      instructor_id: meta.instructor_id === "none" ? null : meta.instructor_id,
      status: meta.status,
      is_template: meta.is_template,
    }).eq("id", program.id);
    if (error) return toast.error(error.message);
    toast.success("Program saved");
    onChanged();
  }

  async function deleteProgram() {
    if (!window.confirm("Delete this program and all of its days?")) return;
    const { error } = await (supabase as any).from("pt_programs").delete().eq("id", program.id);
    if (error) return toast.error(error.message);
    toast.success("Program deleted");
    onDeleted();
  }

  async function duplicateProgram() {
    const { data: auth } = await supabase.auth.getUser();
    const { data: newProg, error } = await (supabase as any).from("pt_programs").insert({
      ...{ ...program, id: undefined, created_at: undefined, updated_at: undefined },
      name: `${program.name} (copy)`,
      created_by: auth?.user?.id ?? null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    for (const d of days) {
      const { data: newDay } = await (supabase as any).from("pt_program_days").insert({
        program_id: newProg.id, label: d.label, weekday: d.weekday, focus: d.focus,
        day_type: d.day_type, display_order: d.display_order,
      }).select("id").single();
      const dayEx = exercises.filter((e: any) => e.day_id === d.id);
      if (dayEx.length && newDay) {
        await (supabase as any).from("pt_program_exercises").insert(
          dayEx.map((e: any) => ({ ...e, id: undefined, created_at: undefined, day_id: newDay.id }))
        );
      }
    }
    toast.success("Program duplicated");
    onChanged();
  }

  async function addDay() {
    const { error } = await (supabase as any).from("pt_program_days").insert({
      program_id: program.id,
      label: `Day ${days.length + 1}`,
      display_order: days.length,
    });
    if (error) return toast.error(error.message);
    refreshDays();
  }

  return (
    <div className="space-y-5">
      <PTCard className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="pt-eyebrow">Program name</label>
            <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} className="mt-1 bg-white border-pt-line" />
          </div>
          <div>
            <label className="pt-eyebrow">Goal</label>
            <Input value={meta.goal} onChange={(e) => setMeta({ ...meta, goal: e.target.value })} className="mt-1 bg-white border-pt-line" />
          </div>
          <div>
            <label className="pt-eyebrow">Client</label>
            <Select value={meta.user_id} onValueChange={(v) => setMeta({ ...meta, user_id: v })}>
              <SelectTrigger className="mt-1 bg-white border-pt-line"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Unassigned / template</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="pt-eyebrow">Trainer</label>
            <Select value={meta.instructor_id} onValueChange={(v) => setMeta({ ...meta, instructor_id: v })}>
              <SelectTrigger className="mt-1 bg-white border-pt-line"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="pt-eyebrow">Weeks</label>
              <Input type="number" value={meta.length_weeks} onChange={(e) => setMeta({ ...meta, length_weeks: e.target.value })}
                className="mt-1 bg-white border-pt-line" />
            </div>
            <div>
              <label className="pt-eyebrow">Sessions / week</label>
              <Input type="number" value={meta.sessions_per_week} onChange={(e) => setMeta({ ...meta, sessions_per_week: e.target.value })}
                className="mt-1 bg-white border-pt-line" />
            </div>
          </div>
          <div>
            <label className="pt-eyebrow">Status</label>
            <Select value={meta.status} onValueChange={(v) => setMeta({ ...meta, status: v })}>
              <SelectTrigger className="mt-1 bg-white border-pt-line"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="pt-eyebrow">Focus / coaching notes</label>
          <Textarea rows={2} value={meta.focus_today} onChange={(e) => setMeta({ ...meta, focus_today: e.target.value })}
            className="mt-1 bg-white border-pt-line" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={ptButtonClass()} onClick={saveMeta}><Save className="h-4 w-4" /> Save</button>
          <button className={ptButtonClass("outline")} onClick={duplicateProgram}><Copy className="h-4 w-4" /> Duplicate</button>
          <label className="flex items-center gap-2 text-[13px] text-pt-muted ml-2">
            <input type="checkbox" checked={meta.is_template} onChange={(e) => setMeta({ ...meta, is_template: e.target.checked })} />
            Save as reusable template
          </label>
          <button className={`${ptButtonClass("ghost")} ml-auto text-pt-red`} onClick={deleteProgram}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </PTCard>

      <div>
        <PTSectionTitle action={<button className={ptButtonClass("outline")} onClick={addDay}><Plus className="h-4 w-4" /> Add day</button>}>
          Training days
        </PTSectionTitle>
        {days.length === 0 ? <PTEmpty>No days yet — add the first one.</PTEmpty> : (
          <div className="space-y-4">
            {days.map((d: any) => (
              <DayCard
                key={d.id}
                day={d}
                exercises={exercises.filter((e: any) => e.day_id === d.id)}
                onChanged={refreshDays}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({ day, exercises, onChanged }: { day: any; exercises: any[]; onChanged: () => void }) {
  const [label, setLabel] = useState(day.label);
  const [focus, setFocus] = useState(day.focus ?? "");

  async function saveDay() {
    const { error } = await (supabase as any).from("pt_program_days").update({ label, focus: focus || null }).eq("id", day.id);
    if (error) return toast.error(error.message);
    toast.success("Day saved");
    onChanged();
  }

  async function deleteDay() {
    if (!window.confirm("Delete this day?")) return;
    const { error } = await (supabase as any).from("pt_program_days").delete().eq("id", day.id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function addExercise() {
    const { error } = await (supabase as any).from("pt_program_exercises").insert({
      day_id: day.id, exercise: "New exercise", sets: 3, reps: "10", display_order: exercises.length,
    });
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function updateExercise(id: string, patch: Record<string, any>) {
    const { error } = await (supabase as any).from("pt_program_exercises").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function removeExercise(id: string) {
    const { error } = await (supabase as any).from("pt_program_exercises").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= exercises.length) return;
    const a = exercises[index], b = exercises[target];
    await Promise.all([
      (supabase as any).from("pt_program_exercises").update({ display_order: b.display_order }).eq("id", a.id),
      (supabase as any).from("pt_program_exercises").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    onChanged();
  }

  return (
    <PTCard className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-pt-line/70 bg-pt-beige/25">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 w-40 bg-white border-pt-line" />
        <Input value={focus} placeholder="Focus (e.g. lower body)" onChange={(e) => setFocus(e.target.value)}
          className="h-8 w-56 bg-white border-pt-line" />
        <button className={ptButtonClass("outline")} onClick={saveDay}>Save</button>
        <button className={ptButtonClass("outline")} onClick={addExercise}><Plus className="h-4 w-4" /> Exercise</button>
        <button className={`${ptButtonClass("ghost")} ml-auto text-pt-red`} onClick={deleteDay}><Trash2 className="h-4 w-4" /></button>
      </div>

      {exercises.length === 0 ? (
        <div className="p-4"><PTEmpty>No exercises in this day.</PTEmpty></div>
      ) : (
        <div className="overflow-x-auto pt-scroll">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left border-b border-pt-line/70">
                {["", "Exercise", "Sets", "Reps", "Load", "Tempo", "Rest", "Cues", ""].map((h, i) => (
                  <th key={i} className="px-2 py-2 pt-eyebrow font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pt-line/50">
              {exercises.map((e: any, i: number) => (
                <tr key={e.id}>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col">
                      <button className="text-pt-muted hover:text-pt-ink" onClick={() => move(i, -1)}><ChevronUp className="h-3 w-3" /></button>
                      <button className="text-pt-muted hover:text-pt-ink" onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input defaultValue={e.exercise} onBlur={(ev) => updateExercise(e.id, { exercise: ev.target.value })}
                      className="h-8 bg-white border-pt-line min-w-[180px]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" defaultValue={e.sets ?? ""} onBlur={(ev) => updateExercise(e.id, { sets: ev.target.value ? Number(ev.target.value) : null })}
                      className="h-8 w-16 bg-white border-pt-line" />
                  </td>
                  {(["reps", "load", "tempo", "rest"] as const).map((f) => (
                    <td key={f} className="px-2 py-1.5">
                      <Input defaultValue={e[f] ?? ""} onBlur={(ev) => updateExercise(e.id, { [f]: ev.target.value || null })}
                        className="h-8 w-20 bg-white border-pt-line" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <Input defaultValue={e.cues ?? ""} onBlur={(ev) => updateExercise(e.id, { cues: ev.target.value || null })}
                      className="h-8 bg-white border-pt-line min-w-[160px]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button className="text-pt-muted hover:text-pt-red" onClick={() => removeExercise(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PTCard>
  );
}
