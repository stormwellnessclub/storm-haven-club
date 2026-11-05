import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Timer, X, Play, BookOpen, Box } from "lucide-react";
import { ExerciseHelp } from "./ExerciseHelp";
import { getExerciseMotion } from "@/lib/exerciseMotions";
import { ActiveWorkoutState, completedSetCount } from "@/lib/workoutJournal";
import type { WorkoutExercise } from "@/hooks/useWorkoutTemplates";
import { cn } from "@/lib/utils";

/** Read-only, phone-friendly view of a saved workout. */
export function WorkoutViewer({ open, onOpenChange, name, notes, exercises, onStart }: {
  open: boolean; onOpenChange: (o: boolean) => void; name: string; notes?: string | null;
  exercises: WorkoutExercise[]; onStart: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[100vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 flex flex-col gap-0">
        <div className="p-5 border-b border-border">
          <DialogTitle className="text-2xl font-serif">{name}</DialogTitle>
          <DialogDescription>{exercises.length} exercises</DialogDescription>
          {notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{notes}</p>}
        </div>
        <ol className="flex-1 overflow-y-auto divide-y divide-border">
          {exercises.map((e, i) => (
            <li key={i} className="p-5 flex gap-4">
              <span className="text-muted-foreground font-medium w-6">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-lg font-medium leading-tight">{e.name}</p>
                <p className="text-base mt-1">{e.sets} sets × {e.reps} reps{e.weight ? ` · ${e.weight} lb` : ""}</p>
                <p className="text-sm text-muted-foreground">Rest {e.rest}s{e.bodyPart ? ` · ${e.bodyPart}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="p-4 border-t border-border">
          <Button size="lg" className="w-full h-14 text-base gap-2" onClick={onStart} disabled={!exercises.length}>
            <Play className="h-5 w-5" /> Start workout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Guided mode: one exercise at a time, check off sets, rest timer. */
export function WorkoutPlayer({ state, onChange, onFinish, onDiscard, onMinimize, finishing }: {
  state: ActiveWorkoutState; onChange: (s: ActiveWorkoutState) => void; onFinish: () => void;
  onDiscard: () => void; onMinimize: () => void; finishing?: boolean;
}) {
  const ex = state.exercises[state.index];
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasDemo = !!getExerciseMotion(ex.name);
  const last = state.lastWeights?.[state.index] ?? [];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!restEnd) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [restEnd]);
  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;
  useEffect(() => { if (restEnd && restLeft === 0) setRestEnd(null); }, [restLeft, restEnd]);

  const { done, total } = completedSetCount(state);
  const isLast = state.index === state.exercises.length - 1;

  const toggle = (setIdx: number) => {
    const d = state.done.map((r) => [...r]);
    d[state.index][setIdx] = !d[state.index][setIdx];
    onChange({ ...state, done: d });
    if (d[state.index][setIdx] && ex.rest > 0) { setNow(Date.now()); setRestEnd(Date.now() + ex.rest * 1000); }
  };
  const setWeight = (setIdx: number, v: string) => {
    const w = state.weights.map((r) => [...r]);
    w[state.index][setIdx] = v === "" ? null : Number(v);
    onChange({ ...state, weights: w });
  };
  const go = (i: number) => { setRestEnd(null); onChange({ ...state, index: i }); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onMinimize(); }}>
      <DialogContent className="max-w-lg w-[100vw] h-[100dvh] sm:h-auto sm:max-h-[95vh] p-0 flex flex-col gap-0 [&>button]:hidden">
        <div className="p-4 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base font-medium truncate">{state.name}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onMinimize}><X className="h-4 w-4 mr-1" />Close</Button>
          </div>
          <DialogDescription className="sr-only">Guided workout</DialogDescription>
          <Progress value={total ? (done / total) * 100 : 0} />
          <p className="text-xs text-muted-foreground">Exercise {state.index + 1} of {state.exercises.length} · {done}/{total} sets done</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <h2 className="text-3xl font-serif leading-tight">{ex.name}</h2>
            <p className="text-lg mt-1">{ex.sets} × {ex.repsLabel || ex.reps} reps</p>
            <p className="text-sm text-muted-foreground">Rest {ex.rest}s between sets{ex.equipment ? ` · ${ex.equipment}` : ""}</p>
            <Button variant="outline" size="sm" className="mt-3 h-10 gap-2" onClick={() => setHelpOpen(true)}>
              {hasDemo ? <Box className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              {hasDemo ? "Watch 3D demo" : "How to do it"}
            </Button>
          </div>
          <ExerciseHelp name={ex.name} equipment={ex.equipment} open={helpOpen} onOpenChange={setHelpOpen} />

          {restEnd && (
            <div className="rounded-lg bg-secondary p-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg"><Timer className="h-5 w-5" /> Rest {restLeft}s</span>
              <Button variant="outline" size="sm" onClick={() => setRestEnd(null)}>Skip</Button>
            </div>
          )}

          <div className="space-y-3">
            {state.done[state.index].map((isDone, s) => (
              <div key={s} className={cn("flex items-center gap-3 rounded-lg border p-3", isDone ? "border-primary bg-primary/5" : "border-border")}>
                <span className="w-14 text-sm font-medium">Set {s + 1}</span>
                <Input inputMode="decimal" type="number" placeholder="lb" className="h-12 text-base w-24"
                  value={state.weights[state.index][s] ?? ""} onChange={(e) => setWeight(s, e.target.value)} />
                <span className="text-sm text-muted-foreground flex-1 leading-tight">
                  {ex.repsLabel || ex.reps} reps
                  {last[s] != null && <span className="block text-xs">Last: {last[s]} lb</span>}
                </span>
                <Button size="icon" variant={isDone ? "default" : "outline"} className="h-12 w-12" onClick={() => toggle(s)} aria-label={`Mark set ${s + 1} done`}>
                  <Check className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="h-14 flex-1" disabled={state.index === 0} onClick={() => go(state.index - 1)}>
              <ChevronLeft className="h-5 w-5" /> Back
            </Button>
            {isLast ? (
              <Button size="lg" className="h-14 flex-[2]" onClick={onFinish} disabled={finishing}>Finish & save</Button>
            ) : (
              <Button size="lg" className="h-14 flex-[2]" onClick={() => go(state.index + 1)}>
                Next <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
            onClick={() => { if (confirm("Discard this workout? Your progress won't be saved.")) onDiscard(); }}>
            Discard workout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
