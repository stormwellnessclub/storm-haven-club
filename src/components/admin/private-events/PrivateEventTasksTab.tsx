import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ListChecks } from "lucide-react";
import type { PrivateEventTask } from "@/hooks/usePrivateEvents";
import { usePrivateEventMutations } from "@/hooks/usePrivateEvents";

const STARTER_TASKS = [
  "Confirm date and times with client",
  "Send proposal",
  "Collect deposit",
  "Confirm guest count",
  "Finalize food & beverage order",
  "Assign staff for the event",
  "Block spaces and notify departments",
  "Set up room the day before",
  "Collect final balance",
  "Send thank-you and review request",
];

export function PrivateEventTasksTab({ eventId, tasks }: { eventId: string; tasks: PrivateEventTask[] }) {
  const { upsertTask, deleteTask } = usePrivateEventMutations();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");

  const add = () => {
    if (!title.trim()) return;
    upsertTask.mutate({
      event_id: eventId,
      title: title.trim(),
      assignee: assignee.trim() || null,
      due_date: due || null,
      sort_order: tasks.length,
    });
    setTitle("");
    setAssignee("");
    setDue("");
  };

  const addStarterList = () => {
    STARTER_TASKS.forEach((t, idx) =>
      upsertTask.mutate({ event_id: eventId, title: t, sort_order: tasks.length + idx }),
    );
  };

  const done = tasks.filter((t) => t.is_done).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          To-do {tasks.length > 0 && <span className="text-muted-foreground">· {done}/{tasks.length} done</span>}
        </CardTitle>
        {tasks.length === 0 && (
          <Button variant="outline" size="sm" onClick={addStarterList}>
            <ListChecks className="mr-1 h-4 w-4" /> Use starter checklist
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <Input
            className="col-span-6"
            placeholder="Add a task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input className="col-span-3" placeholder="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          <Input className="col-span-2" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button className="col-span-1" onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>

        {tasks.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing on the list yet.</p>
        )}

        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-md border p-2">
            <Checkbox
              checked={t.is_done}
              onCheckedChange={(c) =>
                upsertTask.mutate({
                  id: t.id,
                  event_id: eventId,
                  is_done: !!c,
                  done_at: c ? new Date().toISOString() : null,
                } as any)
              }
            />
            <span className={`flex-1 text-sm ${t.is_done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
            {t.assignee && <span className="text-xs text-muted-foreground">{t.assignee}</span>}
            {t.due_date && <span className="text-xs text-muted-foreground">{t.due_date}</span>}
            <Button variant="ghost" size="icon" onClick={() => deleteTask.mutate({ id: t.id, eventId })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
