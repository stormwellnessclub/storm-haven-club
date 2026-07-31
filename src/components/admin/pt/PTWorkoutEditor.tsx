import { useMemo, useState } from "react";
import {
  GripVertical, Copy, Trash2, ChevronDown, ChevronRight, Plus, Link2, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PTBadge, PTCard, ptButtonClass, PTEmptyState } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PTProgramDay, PTProgramExercise } from "@/hooks/pt/usePTProgramBuilder";

interface Props {
  day: PTProgramDay;
  exercises: PTProgramExercise[];
  library: any[];
  onUpdateExercise: (id: string, patch: Record<string, any>) => void;
  onDeleteExercise: (id: string) => void;
  onDuplicateExercise: (id: string) => void;
  onReorder: (ordered: { id: string; display_order: number }[]) => void;
  onAddExercise: (input: Record<string, any>) => void;
}

const SUPERSET_GROUPS = ["A", "B", "C", "D"];

function Cell({ label, value, onSave, placeholder, className, type = "text" }: {
  label: string; value: any; onSave: (v: string) => void; placeholder?: string; className?: string; type?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="pt-eyebrow">{label}</span>
      <Input
        type={type}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        onBlur={(e) => { if (e.target.value !== String(value ?? "")) onSave(e.target.value); }}
        className="h-8 bg-white border-pt-line text-[13px] mt-0.5"
      />
    </label>
  );
}

export function PTWorkoutEditor({
  day, exercises, library, onUpdateExercise, onDeleteExercise, onDuplicateExercise, onReorder, onAddExercise,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [picker, setPicker] = useState("");

  const sorted = useMemo(
    () => [...exercises].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [exercises],
  );

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = sorted.map((e) => e.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids.map((id, i) => ({ id, display_order: i })));
    setDragId(null);
  }

  function addFromLibrary(id: string) {
    const item = library.find((l) => l.id === id);
    if (!item) return;
    onAddExercise({
      day_id: day.id,
      exercise: item.name,
      exercise_id: item.id,
      sets: item.default_sets ?? 3,
      reps: item.default_reps ?? "10",
      tempo: item.default_tempo ?? null,
      rest: item.default_rest ?? null,
      cues: item.cues ?? null,
      media_url: item.media_url ?? null,
      display_order: sorted.length,
    });
    setPicker("");
  }

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <PTEmptyState title="No exercises yet" description="Add movements from the library or build a custom entry." />
      )}

      {sorted.map((ex, i) => {
        const expanded = open[ex.id];
        return (
          <PTCard
            key={ex.id}
            className={cn("p-3", dragId === ex.id && "opacity-60")}
          >
            <div
              draggable
              onDragStart={() => setDragId(ex.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(ex.id)}
              className="flex items-start gap-2"
            >
              <button className="mt-6 cursor-grab text-pt-muted hover:text-pt-ink" aria-label="Drag to reorder">
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
                  <label className="block">
                    <span className="pt-eyebrow">#{i + 1} Exercise</span>
                    <Input
                      defaultValue={ex.exercise}
                      onBlur={(e) => e.target.value !== ex.exercise && onUpdateExercise(ex.id, { exercise: e.target.value })}
                      className="h-8 bg-white border-pt-line text-[13px] mt-0.5 font-medium"
                    />
                  </label>
                  <Cell label="Sets" type="number" value={ex.sets} onSave={(v) => onUpdateExercise(ex.id, { sets: v === "" ? null : Number(v) })} />
                  <Cell label="Reps" value={ex.reps} onSave={(v) => onUpdateExercise(ex.id, { reps: v || null })} />
                  <Cell label="Load" value={ex.load} onSave={(v) => onUpdateExercise(ex.id, { load: v || null })} placeholder="lb / band" />
                  <Cell label="Rest" value={ex.rest} onSave={(v) => onUpdateExercise(ex.id, { rest: v || null })} placeholder="90s" />
                  <Cell label="RPE" type="number" value={ex.rpe} onSave={(v) => onUpdateExercise(ex.id, { rpe: v === "" ? null : Number(v) })} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setOpen({ ...open, [ex.id]: !expanded })}
                    className="inline-flex items-center gap-1 text-[12px] text-pt-muted hover:text-pt-ink"
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Coaching detail
                  </button>
                  {ex.superset_group && <PTBadge tone="gold"><Link2 className="h-3 w-3" /> Superset {ex.superset_group}</PTBadge>}
                  {ex.media_url && <PTBadge><ImageIcon className="h-3 w-3" /> Media</PTBadge>}
                  {ex.is_pr && <PTBadge tone="green">PR</PTBadge>}
                  <span className="ml-auto flex items-center gap-1">
                    <Select
                      value={ex.superset_group ?? "none"}
                      onValueChange={(v) => onUpdateExercise(ex.id, { superset_group: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="h-7 w-28 bg-white border-pt-line text-[12px]"><SelectValue placeholder="Superset" /></SelectTrigger>
                      <SelectContent className="bg-white border-pt-line z-50">
                        <SelectItem value="none">No superset</SelectItem>
                        {SUPERSET_GROUPS.map((g) => <SelectItem key={g} value={g}>Superset {g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button className={ptButtonClass("ghost")} onClick={() => onDuplicateExercise(ex.id)} aria-label="Duplicate exercise">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button className={ptButtonClass("ghost")} onClick={() => onDeleteExercise(ex.id)} aria-label="Remove exercise">
                      <Trash2 className="h-3.5 w-3.5 text-pt-red" />
                    </button>
                  </span>
                </div>

                {expanded && (
                  <div className="grid gap-2 md:grid-cols-2 pt-1">
                    <Cell label="Tempo" value={ex.tempo} onSave={(v) => onUpdateExercise(ex.id, { tempo: v || null })} placeholder="3-1-1" />
                    <Cell label="Media link" value={ex.media_url} onSave={(v) => onUpdateExercise(ex.id, { media_url: v || null })} placeholder="https://" />
                    <Cell label="Substitution" value={ex.substitution} onSave={(v) => onUpdateExercise(ex.id, { substitution: v || null })} />
                    <Cell label="Modification" value={ex.modification} onSave={(v) => onUpdateExercise(ex.id, { modification: v || null })} />
                    <label className="block md:col-span-2">
                      <span className="pt-eyebrow">Trainer cues</span>
                      <Textarea
                        defaultValue={ex.cues ?? ""}
                        onBlur={(e) => e.target.value !== (ex.cues ?? "") && onUpdateExercise(ex.id, { cues: e.target.value || null })}
                        className="bg-white border-pt-line text-[13px] mt-0.5 min-h-16"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="pt-eyebrow">Notes</span>
                      <Textarea
                        defaultValue={ex.notes ?? ""}
                        onBlur={(e) => e.target.value !== (ex.notes ?? "") && onUpdateExercise(ex.id, { notes: e.target.value || null })}
                        className="bg-white border-pt-line text-[13px] mt-0.5 min-h-16"
                      />
                    </label>
                    {ex.previous_result && (
                      <p className="text-[12px] text-pt-muted md:col-span-2">Last recorded: {ex.previous_result}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </PTCard>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Select value={picker} onValueChange={addFromLibrary}>
          <SelectTrigger className="h-8 w-64 bg-white border-pt-line text-[13px]">
            <SelectValue placeholder="Add from workout library" />
          </SelectTrigger>
          <SelectContent className="bg-white border-pt-line z-50 max-h-72">
            {library.filter((l) => l.is_active !== false).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}{l.muscle_group ? ` · ${l.muscle_group}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          className={ptButtonClass("outline")}
          onClick={() => onAddExercise({ day_id: day.id, exercise: "New exercise", display_order: sorted.length })}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Custom exercise
        </button>
      </div>
    </div>
  );
}
