import { useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Copy, Play, Trash2, Plus, NotebookPen } from "lucide-react";
import { addDaysISO, detroitTodayISO, weekDays, weekStartISO } from "@/lib/workoutJournal";
import { useWorkoutPlan, usePlanMutations, PlanEntry } from "@/hooks/useWorkoutJournal";
import type { WorkoutTemplate } from "@/hooks/useWorkoutTemplates";
import { cn } from "@/lib/utils";

const SPECIAL = [
  { v: "__rest", label: "Rest day" },
  { v: "__class", label: "Class at the club" },
  { v: "__cardio", label: "Cardio / walk" },
];

export function WeekPlanner({ templates, onStart }: {
  templates: WorkoutTemplate[];
  onStart: (entry: PlanEntry, template: WorkoutTemplate) => void;
}) {
  const today = detroitTodayISO();
  const [start, setStart] = useState(weekStartISO(today));
  const { data: entries = [] } = useWorkoutPlan(start);
  const { add, update, remove, copyWeek } = usePlanMutations();
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const byId = new Map(templates.map((t) => [t.id, t]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => setStart(addDaysISO(start, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="font-medium">{format(new Date(`${start}T12:00:00`), "MMM d")} – {format(new Date(`${addDaysISO(start, 6)}T12:00:00`), "MMM d")}</p>
          {start !== weekStartISO(today) && <button className="text-xs text-primary underline" onClick={() => setStart(weekStartISO(today))}>This week</button>}
        </div>
        <Button variant="outline" size="icon" onClick={() => setStart(addDaysISO(start, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {entries.length === 0 && (
        <Button variant="ghost" size="sm" className="w-full gap-2" onClick={() => copyWeek.mutate({ from: addDaysISO(start, -7), to: start })}>
          <Copy className="h-4 w-4" /> Copy last week's plan
        </Button>
      )}

      {weekDays(start).map((day) => {
        const items = entries.filter((e) => e.plan_date === day);
        const past = day < today;
        return (
          <Card key={day} className={cn("p-4", day === today && "border-primary")}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{format(new Date(`${day}T12:00:00`), "EEEE, MMM d")}{day === today && <span className="text-primary text-xs ml-2">Today</span>}</p>
            </div>
            <div className="space-y-2">
              {items.map((e) => {
                const t = e.template_id ? byId.get(e.template_id) : undefined;
                const title = t?.template_name || e.label || "Workout";
                const status = e.status === "done" ? "Done" : e.status === "skipped" ? "Skipped" : past ? "Missed" : "Planned";
                return (
                  <div key={e.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-base font-medium truncate">{title}</p>
                      <Badge variant={status === "Done" ? "default" : "secondary"}>{status}</Badge>
                    </div>
                    {t && <p className="text-sm text-muted-foreground line-clamp-2">{t.exercises.map((x) => x.name).join(" · ")}</p>}
                    {e.notes && noteOpen !== e.id && <p className="text-sm italic whitespace-pre-wrap">{e.notes}</p>}
                    {noteOpen === e.id && (
                      <Textarea autoFocus defaultValue={e.notes || ""} placeholder="How did it feel?"
                        onBlur={(ev) => { update.mutate({ id: e.id, notes: ev.target.value || null }); setNoteOpen(null); }} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {t && e.status !== "done" && (
                        <Button size="sm" className="gap-1" onClick={() => onStart(e, t)}><Play className="h-4 w-4" />Start</Button>
                      )}
                      {!t && e.status !== "done" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: e.id, status: "done" })}>Mark done</Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setNoteOpen(e.id)}><NotebookPen className="h-4 w-4" />Note</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(e.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
              <Select value="" onValueChange={(v) => {
                const special = SPECIAL.find((s) => s.v === v);
                add.mutate(special ? { plan_date: day, label: special.label } : { plan_date: day, template_id: v });
              }}>
                <SelectTrigger className="h-10 text-muted-foreground"><span className="flex items-center gap-2"><Plus className="h-4 w-4" /><SelectValue placeholder="Plan something" /></span></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                  {SPECIAL.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
