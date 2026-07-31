import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Copy, Trash2, Save, Printer, Download, Share2, Layers, GripVertical, FileStack,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PTShell, PTPageHeader, PTCard, PTSectionTitle, PTBadge, PTStatus, PTEmptyState, PTModal,
  ptButtonClass, PTDropdown, PTConfirmDialog,
} from "@/components/admin/pt/PTUI";
import { PTWorkspaceNav } from "@/components/admin/pt/PTWorkspaceNav";
import { PTWorkoutEditor } from "@/components/admin/pt/PTWorkoutEditor";
import { usePTPeople, usePTTrainers } from "@/hooks/pt/usePTPortal";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import {
  usePTProgramList, usePTProgramDetail, usePTProgramMutations, usePTExerciseLibrary,
  PT_DAY_PRESETS, type PTProgramPhase,
} from "@/hooks/pt/usePTProgramBuilder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PTPrograms() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string | undefined>(params.get("program") ?? undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [dragDayId, setDragDayId] = useState<string | null>(null);
  // Destructive actions must always be confirmed before they run.
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: programs = [], isLoading } = usePTProgramList();
  const { data: detail } = usePTProgramDetail(selected);
  const { data: library = [] } = usePTExerciseLibrary();
  const { data: directory = [] } = usePTClientDirectory();
  const { data: trainers = [] } = usePTTrainers();
  const { data: people = {} } = usePTPeople(programs.map((p: any) => p.user_id).filter(Boolean));
  const m = usePTProgramMutations(selected);

  const visible = useMemo(
    () => programs.filter((p: any) => (showTemplates ? p.is_template : !p.is_template)),
    [programs, showTemplates],
  );

  useEffect(() => {
    if (!selected && visible.length) setSelected(visible[0].id);
  }, [visible, selected]);

  const program = detail?.program;
  const days = detail?.days ?? [];
  const exercises = detail?.exercises ?? [];
  const activeDay = days.find((d) => d.id === activeDayId) ?? days[0];

  useEffect(() => {
    if (days.length && !days.some((d) => d.id === activeDayId)) setActiveDayId(days[0].id);
  }, [days, activeDayId]);

  const phases: PTProgramPhase[] = Array.isArray(program?.phases) ? program.phases : [];
  const weeks = Math.max(1, program?.length_weeks ?? 1);

  const select = (id: string) => { setSelected(id); setParams({ program: id }); };

  function handleDayDrop(targetId: string) {
    if (!dragDayId || dragDayId === targetId) return;
    const ordered = [...days];
    const from = ordered.findIndex((d) => d.id === dragDayId);
    const to = ordered.findIndex((d) => d.id === targetId);
    const [moved] = ordered.splice(from, 1);
    moved.week_number = ordered[to]?.week_number ?? moved.week_number;
    ordered.splice(to, 0, moved);
    m.reorderDays.mutate(ordered.map((d, i) => ({ id: d.id, display_order: i, week_number: d.week_number })));
    setDragDayId(null);
  }

  function programText() {
    const lines = [`${program?.name ?? "Program"}`, program?.goal ? `Goal: ${program.goal}` : "", ""];
    days.forEach((d) => {
      lines.push(`Week ${d.week_number} — ${d.label}${d.focus ? ` (${d.focus})` : ""}`);
      exercises.filter((e) => e.day_id === d.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .forEach((e, i) => {
          lines.push(`  ${i + 1}. ${e.exercise} — ${e.sets ?? "-"} x ${e.reps ?? "-"}${e.load ? ` @ ${e.load}` : ""}${e.rest ? ` · rest ${e.rest}` : ""}${e.superset_group ? ` [SS ${e.superset_group}]` : ""}`);
          if (e.cues) lines.push(`     cues: ${e.cues}`);
        });
      if (d.homework) lines.push(`  Homework: ${d.homework}`);
      lines.push("");
    });
    return lines.filter((l) => l !== undefined).join("\n");
  }

  function exportProgram() {
    const blob = new Blob([programText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(program?.name ?? "program").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareRecap() {
    await navigator.clipboard.writeText(programText());
    toast.success("Client recap copied to clipboard");
  }

  function printProgram() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<pre style="font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap">${programText().replace(/</g, "&lt;")}</pre>`);
    win.document.close();
    win.print();
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Programs & Progress"
        title="Program Builder"
        subtitle="Build training blocks, phase them, and assign them to clients."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => setShowTemplates(!showTemplates)}>
              <FileStack className="h-4 w-4 mr-1.5" />{showTemplates ? "Show programs" : "Show templates"}
            </button>
            <button className={ptButtonClass("primary")} onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />New program
            </button>
          </>
        }
      />
      <PTWorkspaceNav />

      <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
        {/* ------------------------------------------------------- list */}
        <div>
          <PTSectionTitle>{showTemplates ? "Templates" : "Programs"}</PTSectionTitle>
          <PTCard padded={false}>
            {isLoading ? (
              <div className="p-4 text-[13px] text-pt-muted">Loading…</div>
            ) : visible.length === 0 ? (
              <div className="p-4">
                <PTEmptyState title={showTemplates ? "No templates saved" : "No programs yet"}
                  description="Create one from scratch or save an existing program as a template." />
              </div>
            ) : (
              <ul className="divide-y divide-pt-line/70 max-h-[70vh] overflow-y-auto pt-scroll">
                {visible.map((p: any) => (
                  <li key={p.id}>
                    <button
                      onClick={() => select(p.id)}
                      className={cn("w-full text-left px-4 py-3 hover:bg-pt-beige/40 transition-colors",
                        selected === p.id && "bg-pt-beige/60")}
                    >
                      <div className="text-[13px] font-medium text-pt-ink truncate">{p.name}</div>
                      <div className="text-[11px] text-pt-muted truncate">
                        {p.is_template ? "Template" : p.user_id ? people[p.user_id]?.name ?? "Client" : "Unassigned"}
                        {p.length_weeks ? ` · ${p.length_weeks} wk` : ""}
                        {p.sessions_per_week ? ` · ${p.sessions_per_week}x/wk` : ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PTCard>
        </div>

        {/* ---------------------------------------------------- builder */}
        {!program ? (
          <PTEmptyState icon={Layers} title="Select a program" description="Pick a program on the left or create a new one." />
        ) : (
          <div className="space-y-4" ref={printRef}>
            <PTCard>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <Input
                    defaultValue={program.name}
                    key={`name-${program.id}`}
                    onBlur={(e) => e.target.value !== program.name && m.updateProgram.mutate({ id: program.id, patch: { name: e.target.value } })}
                    className="h-9 bg-white border-pt-line text-[15px] font-medium"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <PTStatus status={program.status ?? "active"} />
                    {program.is_template && <PTBadge tone="gold">Template</PTBadge>}
                    {program.user_id
                      ? <PTBadge tone="green">{people[program.user_id]?.name ?? "Assigned"}</PTBadge>
                      : <PTBadge>Unassigned</PTBadge>}
                    {phases.map((ph) => <PTBadge key={ph.name} tone="noir">{ph.name} · {ph.weeks}wk</PTBadge>)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className={ptButtonClass("outline")} onClick={() => setAssignOpen(true)}>Assign to client</button>
                  <PTDropdown
                    label="Program actions"
                    trigger={<button className={ptButtonClass("ghost")}>Actions</button>}
                    items={[
                      { label: "Duplicate program", icon: Copy, onSelect: () => m.duplicateProgram.mutate({ sourceId: program.id }, { onSuccess: (id) => select(id) }) },
                      { label: "Save as template", icon: Save, onSelect: () => m.duplicateProgram.mutate({ sourceId: program.id, name: `${program.name} template`, asTemplate: true }) },
                      { label: "Manage phases", icon: Layers, onSelect: () => setPhaseOpen(true) },
                      { label: "Print program", icon: Printer, onSelect: printProgram, separatorBefore: true },
                      { label: "Export program", icon: Download, onSelect: exportProgram },
                      { label: "Share client recap", icon: Share2, onSelect: shareRecap },
                      { label: "Delete program", icon: Trash2, destructive: true, separatorBefore: true,
                        onSelect: () => setConfirmDeleteProgram(true) },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block">
                  <span className="pt-eyebrow">Goal</span>
                  <Input defaultValue={program.goal ?? ""} key={`goal-${program.id}`}
                    onBlur={(e) => m.updateProgram.mutate({ id: program.id, patch: { goal: e.target.value || null } })}
                    className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                </label>
                <label className="block">
                  <span className="pt-eyebrow">Start date</span>
                  <Input type="date" defaultValue={program.start_date ?? ""} key={`sd-${program.id}`}
                    onBlur={(e) => m.updateProgram.mutate({ id: program.id, patch: { start_date: e.target.value || null } })}
                    className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                </label>
                <label className="block">
                  <span className="pt-eyebrow">Length (weeks)</span>
                  <Input type="number" min={1} defaultValue={program.length_weeks ?? 4} key={`lw-${program.id}`}
                    onBlur={(e) => m.updateProgram.mutate({ id: program.id, patch: { length_weeks: Number(e.target.value) || 1 } })}
                    className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                </label>
                <label className="block">
                  <span className="pt-eyebrow">Sessions / week</span>
                  <Input type="number" min={1} defaultValue={program.sessions_per_week ?? 3} key={`spw-${program.id}`}
                    onBlur={(e) => m.updateProgram.mutate({ id: program.id, patch: { sessions_per_week: Number(e.target.value) || 1 } })}
                    className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                </label>
                <label className="block">
                  <span className="pt-eyebrow">Next reassessment</span>
                  <Input type="date" defaultValue={program.next_reassessment ?? ""} key={`nr-${program.id}`}
                    onBlur={(e) => m.updateProgram.mutate({ id: program.id, patch: { next_reassessment: e.target.value || null } })}
                    className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                </label>
              </div>
            </PTCard>

            {/* weekly workout cards */}
            <PTCard>
              <PTSectionTitle
                action={
                  <Select value="" onValueChange={(v) => {
                    const preset = PT_DAY_PRESETS.find((p) => p.label === v);
                    if (!preset) return;
                    m.addDay.mutate({
                      program_id: program.id, label: preset.label, focus: preset.focus || null,
                      day_type: preset.day_type, week_number: 1, display_order: days.length,
                    }, { onSuccess: (id) => setActiveDayId(id) });
                  }}>
                    <SelectTrigger className="h-8 w-56 bg-white border-pt-line text-[13px]">
                      <SelectValue placeholder="Add workout day" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-pt-line z-50">
                      {PT_DAY_PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                }
              >
                Weekly workouts
              </PTSectionTitle>

              {days.length === 0 ? (
                <PTEmptyState title="No workout days yet" description="Add lower body, push, pull, conditioning or recovery days." />
              ) : (
                Array.from({ length: weeks }, (_, w) => w + 1).map((week) => {
                  const weekDays = days.filter((d) => d.week_number === week);
                  if (!weekDays.length && week !== 1) return null;
                  return (
                    <div key={week} className="mb-4 last:mb-0">
                      <div className="pt-eyebrow mb-2">Week {week}</div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {weekDays.map((d) => {
                          const count = exercises.filter((e) => e.day_id === d.id).length;
                          const recovery = d.day_type === "recovery";
                          return (
                            <button
                              key={d.id}
                              draggable
                              onDragStart={() => setDragDayId(d.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDayDrop(d.id)}
                              onClick={() => setActiveDayId(d.id)}
                              className={cn(
                                "text-left rounded-xl border p-3 transition-colors",
                                activeDay?.id === d.id ? "border-pt-gold bg-pt-gold/5" : "border-pt-line hover:bg-pt-beige/40",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-3.5 w-3.5 text-pt-muted" />
                                <span className="text-[13px] font-medium text-pt-ink truncate">{d.label}</span>
                                {recovery && <PTBadge tone="green">Recovery</PTBadge>}
                              </div>
                              <div className="text-[11px] text-pt-muted mt-1 truncate">{d.focus || "No focus set"}</div>
                              <div className="text-[11px] text-pt-muted mt-1">{count} exercise{count === 1 ? "" : "s"}</div>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => m.addDay.mutate({
                            program_id: program.id, label: "Custom Day", day_type: "custom",
                            week_number: week, display_order: days.length,
                          }, { onSuccess: (id) => setActiveDayId(id) })}
                          className="rounded-xl border border-dashed border-pt-line p-3 text-[13px] text-pt-muted hover:text-pt-ink hover:bg-pt-beige/30"
                        >
                          <Plus className="h-4 w-4 mx-auto mb-1" /> Add day to week {week}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </PTCard>

            {/* workout editor */}
            {activeDay && (
              <PTCard>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <div className="grid gap-2 sm:grid-cols-3 flex-1">
                    <label className="block">
                      <span className="pt-eyebrow">Workout name</span>
                      <Input key={`dl-${activeDay.id}`} defaultValue={activeDay.label}
                        onBlur={(e) => e.target.value !== activeDay.label && m.updateDay.mutate({ id: activeDay.id, patch: { label: e.target.value } })}
                        className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                    </label>
                    <label className="block">
                      <span className="pt-eyebrow">Focus</span>
                      <Input key={`df-${activeDay.id}`} defaultValue={activeDay.focus ?? ""}
                        onBlur={(e) => m.updateDay.mutate({ id: activeDay.id, patch: { focus: e.target.value || null } })}
                        className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                    </label>
                    <label className="block">
                      <span className="pt-eyebrow">Week</span>
                      <Input key={`dw-${activeDay.id}`} type="number" min={1} defaultValue={activeDay.week_number}
                        onBlur={(e) => m.updateDay.mutate({ id: activeDay.id, patch: { week_number: Number(e.target.value) || 1 } })}
                        className="h-8 bg-white border-pt-line text-[13px] mt-0.5" />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={ptButtonClass("ghost")} onClick={() => m.duplicateDay.mutate(activeDay.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />Duplicate workout
                    </button>
                    <button className={ptButtonClass("ghost")} onClick={() => m.deleteDay.mutate(activeDay.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5 text-pt-red" />Remove day
                    </button>
                  </div>
                </div>

                <PTWorkoutEditor
                  day={activeDay}
                  exercises={exercises.filter((e) => e.day_id === activeDay.id)}
                  library={library}
                  onAddExercise={(input) => m.addExercise.mutate(input as any)}
                  onUpdateExercise={(id, patch) => m.updateExercise.mutate({ id, patch })}
                  onDeleteExercise={(id) => m.deleteExercise.mutate(id)}
                  onDuplicateExercise={(id) => m.duplicateExercise.mutate(id)}
                  onReorder={(ordered) => m.reorderExercises.mutate(ordered)}
                />

                <div className="grid gap-2 sm:grid-cols-2 mt-4">
                  <label className="block">
                    <span className="pt-eyebrow">Homework</span>
                    <Textarea key={`dh-${activeDay.id}`} defaultValue={activeDay.homework ?? ""}
                      onBlur={(e) => m.updateDay.mutate({ id: activeDay.id, patch: { homework: e.target.value || null } })}
                      className="bg-white border-pt-line text-[13px] mt-0.5 min-h-20" />
                  </label>
                  <label className="block">
                    <span className="pt-eyebrow">Workout notes</span>
                    <Textarea key={`dn-${activeDay.id}`} defaultValue={activeDay.notes ?? ""}
                      onBlur={(e) => m.updateDay.mutate({ id: activeDay.id, patch: { notes: e.target.value || null } })}
                      className="bg-white border-pt-line text-[13px] mt-0.5 min-h-20" />
                  </label>
                </div>
              </PTCard>
            )}
          </div>
        )}
      </div>

      <NewProgramModal
        open={newOpen} onOpenChange={setNewOpen}
        templates={programs.filter((p: any) => p.is_template)}
        clients={directory}
        trainers={trainers}
        onCreate={(input) => {
          if (input.templateId) {
            m.duplicateProgram.mutate(
              { sourceId: input.templateId, name: input.name, userId: input.userId },
              { onSuccess: (id) => { select(id); setNewOpen(false); } },
            );
          } else {
            m.createProgram.mutate(
              {
                name: input.name, user_id: input.userId ?? null, instructor_id: input.trainerId ?? null,
                length_weeks: input.lengthWeeks, sessions_per_week: input.perWeek, is_template: input.asTemplate,
              },
              { onSuccess: (id) => { select(id); setNewOpen(false); } },
            );
          }
        }}
      />

      <PTModal
        open={assignOpen} onOpenChange={setAssignOpen} title="Assign program to client"
        description="Assigning copies this program so the original stays reusable."
      >
        <div className="max-h-80 overflow-y-auto pt-scroll divide-y divide-pt-line/70">
          {directory.map((c) => (
            <button
              key={c.userId}
              className="w-full text-left px-2 py-2.5 hover:bg-pt-beige/40 text-[13px]"
              onClick={() => {
                if (!program) return;
                if (program.is_template) {
                  m.duplicateProgram.mutate({ sourceId: program.id, name: `${program.name} — ${c.name}`, userId: c.userId },
                    { onSuccess: (id) => { select(id); setAssignOpen(false); } });
                } else {
                  m.updateProgram.mutate({ id: program.id, patch: { user_id: c.userId } },
                    { onSuccess: () => setAssignOpen(false) });
                }
              }}
            >
              {c.name} <span className="text-pt-muted">{c.email}</span>
            </button>
          ))}
        </div>
      </PTModal>

      <PhaseModal
        open={phaseOpen} onOpenChange={setPhaseOpen} phases={phases}
        onSave={(next) => program && m.updateProgram.mutate({ id: program.id, patch: { phases: next } }, { onSuccess: () => setPhaseOpen(false) })}
      />
    </PTShell>
  );
}

/* ------------------------------------------------------------- modals */

function NewProgramModal({ open, onOpenChange, templates, clients, trainers, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; templates: any[]; clients: any[]; trainers: any[];
  onCreate: (input: { name: string; templateId?: string | null; userId?: string | null; trainerId?: string | null; lengthWeeks: number; perWeek: number; asTemplate: boolean }) => void;
}) {
  const [form, setForm] = useState({ name: "", templateId: "scratch", userId: "none", trainerId: "none", lengthWeeks: 4, perWeek: 3, asTemplate: false });
  return (
    <PTModal
      open={open} onOpenChange={onOpenChange} title="New program"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.name.trim()}
          onClick={() => onCreate({
            name: form.name.trim(),
            templateId: form.templateId === "scratch" ? null : form.templateId,
            userId: form.userId === "none" ? null : form.userId,
            trainerId: form.trainerId === "none" ? null : form.trainerId,
            lengthWeeks: form.lengthWeeks, perWeek: form.perWeek, asTemplate: form.asTemplate,
          })}>Create</button>
      </>}
    >
      <div className="space-y-3">
        <div><Label className="pt-eyebrow">Program name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Start from</Label>
          <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50">
              <SelectItem value="scratch">Blank program</SelectItem>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="pt-eyebrow">Client</Label>
            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
              <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white border-pt-line z-50 max-h-72">
                <SelectItem value="none">Unassigned</SelectItem>
                {clients.map((c: any) => <SelectItem key={c.userId} value={c.userId}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="pt-eyebrow">Trainer</Label>
            <Select value={form.trainerId} onValueChange={(v) => setForm({ ...form, trainerId: v })}>
              <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white border-pt-line z-50">
                <SelectItem value="none">Unassigned</SelectItem>
                {trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="pt-eyebrow">Length (weeks)</Label>
            <Input type="number" min={1} value={form.lengthWeeks} onChange={(e) => setForm({ ...form, lengthWeeks: Number(e.target.value) })} className="bg-white border-pt-line" /></div>
          <div><Label className="pt-eyebrow">Sessions / week</Label>
            <Input type="number" min={1} value={form.perWeek} onChange={(e) => setForm({ ...form, perWeek: Number(e.target.value) })} className="bg-white border-pt-line" /></div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-pt-line px-3 py-2.5">
          <div>
            <div className="text-[13px] text-pt-ink">Save as reusable template</div>
            <div className="text-xs text-pt-muted">Templates stay unassigned and can be copied to any client.</div>
          </div>
          <Switch checked={form.asTemplate} onCheckedChange={(v) => setForm({ ...form, asTemplate: v })} />
        </div>
      </div>
    </PTModal>
  );
}

function PhaseModal({ open, onOpenChange, phases, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; phases: PTProgramPhase[]; onSave: (p: PTProgramPhase[]) => void;
}) {
  const [list, setList] = useState<PTProgramPhase[]>(phases.length ? phases : [{ name: "Foundation", weeks: 4, focus: "" }]);
  useEffect(() => { if (open) setList(phases.length ? phases : [{ name: "Foundation", weeks: 4, focus: "" }]); }, [open, phases]);
  return (
    <PTModal
      open={open} onOpenChange={onOpenChange} title="Training phases"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} onClick={() => onSave(list.filter((p) => p.name.trim()))}>Save phases</button>
      </>}
    >
      <div className="space-y-2">
        {list.map((p, i) => (
          <div key={i} className="grid grid-cols-[2fr_80px_2fr_auto] gap-2 items-end">
            <label className="block"><span className="pt-eyebrow">Phase</span>
              <Input value={p.name} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="h-8 bg-white border-pt-line text-[13px]" /></label>
            <label className="block"><span className="pt-eyebrow">Weeks</span>
              <Input type="number" min={1} value={p.weeks} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, weeks: Number(e.target.value) } : x))} className="h-8 bg-white border-pt-line text-[13px]" /></label>
            <label className="block"><span className="pt-eyebrow">Focus</span>
              <Input value={p.focus ?? ""} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, focus: e.target.value } : x))} className="h-8 bg-white border-pt-line text-[13px]" /></label>
            <button className={ptButtonClass("ghost")} onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Remove phase">
              <Trash2 className="h-3.5 w-3.5 text-pt-red" />
            </button>
          </div>
        ))}
        <button className={ptButtonClass("outline")} onClick={() => setList([...list, { name: "", weeks: 4, focus: "" }])}>
          <Plus className="h-4 w-4 mr-1.5" />Add phase
        </button>
      </div>
    </PTModal>
  );
}
