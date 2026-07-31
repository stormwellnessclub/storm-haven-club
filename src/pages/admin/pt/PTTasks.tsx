import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format as fmtDate, isBefore, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, isSameDay, isSameMonth,
} from "date-fns";
import { ListChecks, Plus, Check, Trash2, LayoutGrid, List, CalendarDays, ChevronLeft, ChevronRight, Repeat, Download } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge,
  PTModal, ptButtonClass, PTConfirmDialog,
} from "@/components/admin/pt/PTUI";
import { usePTPeople, usePTTrainers } from "@/hooks/pt/usePTPortal";
import { usePTTaskList, usePTTaskBoardMutations, PTTaskRow, PT_TASK_TYPES, PT_TASK_STATUSES } from "@/hooks/pt/usePTTaskBoard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/ptExport";

type View = "list" | "board" | "calendar";

const STATUS_LABEL: Record<string, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

function priorityTone(p: string) {
  return p === "urgent" ? "red" : p === "high" ? "amber" : p === "low" ? "neutral" : "gold";
}

export default function PTTasks() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>("list");
  const [createOpen, setCreateOpen] = useState(params.get("new") === "1");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [filterTrainer, setFilterTrainer] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const { data: allTasks = [], isLoading } = usePTTaskList();
  const { create, update, complete, remove } = usePTTaskBoardMutations();
  const { data: trainers = [] } = usePTTrainers();
  const trainerName = useMemo(() => Object.fromEntries(trainers.map((t) => [t.id, t.name])), [trainers]);
  const { data: people = {} } = usePTPeople(allTasks.map((t) => t.client_user_id).filter(Boolean) as string[]);

  const tasks = useMemo(() => allTasks.filter((t) => {
    if (!showDone && t.completed_at) return false;
    if (filterTrainer !== "all" && t.instructor_id !== filterTrainer && t.assigned_to !== filterTrainer) return false;
    if (filterType !== "all" && (t.task_type || "general") !== filterType) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  }), [allTasks, showDone, filterTrainer, filterType, filterPriority]);

  const openCount = allTasks.filter((t) => !t.completed_at).length;

  function closeCreate() {
    setCreateOpen(false);
    if (params.get("new")) { params.delete("new"); setParams(params, { replace: true }); }
  }

  const columns: PTColumn<PTTaskRow>[] = [
    {
      key: "done", header: "", className: "w-10",
      render: (t) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); complete.mutate({ id: t.id, completed: !t.completed_at }); }}
          className={`h-5 w-5 rounded-md border grid place-items-center transition-colors ${t.completed_at ? "bg-pt-green border-pt-green text-white" : "border-pt-line hover:border-pt-gold"}`}
          aria-label={t.completed_at ? "Mark incomplete" : "Mark complete"}
        >
          {t.completed_at && <Check className="h-3 w-3" />}
        </button>
      ),
    },
    {
      key: "title", header: "Task",
      render: (t) => (
        <div className="min-w-0">
          <div className={`flex items-center gap-1.5 ${t.completed_at ? "line-through text-pt-muted" : "text-pt-ink"}`}>
            {t.title}
            {t.recurrence && t.recurrence !== "none" && <Repeat className="h-3 w-3 text-pt-gold" />}
          </div>
          {t.detail && <div className="text-xs text-pt-muted line-clamp-1">{t.detail}</div>}
        </div>
      ),
    },
    { key: "client", header: "Client", render: (t) => (t.client_user_id ? people[t.client_user_id]?.name ?? "—" : "—") },
    { key: "staff", header: "Assigned", render: (t) => trainerName[t.instructor_id ?? ""] ?? (t.assigned_to ? "Staff" : "—") },
    { key: "type", header: "Type", render: (t) => <span className="capitalize">{(t.task_type || "general").replace(/_/g, " ")}</span> },
    {
      key: "status", header: "Status",
      render: (t) => (
        <Select value={t.status || "todo"} onValueChange={(v) => update.mutate({ id: t.id, patch: { status: v, completed_at: v === "done" ? new Date().toISOString() : null } })}>
          <SelectTrigger className="h-7 w-32 border-pt-line bg-white text-xs" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PT_TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
    { key: "priority", header: "Priority", render: (t) => <PTBadge tone={priorityTone(t.priority) as any}><span className="capitalize">{t.priority}</span></PTBadge> },
    {
      key: "due", header: "Due",
      render: (t) => {
        if (!t.due_at) return "—";
        const overdue = !t.completed_at && isBefore(new Date(t.due_at), new Date());
        return <span className={overdue ? "text-pt-red font-medium" : ""}>{fmtDate(new Date(t.due_at), "MMM d, h:mm a")}</span>;
      },
    },
    {
      key: "actions", header: "", align: "right",
      render: (t) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmId(t.id); }} className="text-pt-muted hover:text-pt-red transition-colors" aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [month]);

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Operations"
        title="Tasks"
        subtitle={`${openCount} open ${openCount === 1 ? "task" : "tasks"} across the team.`}
        actions={
          <>
            <button
              className={ptButtonClass("outline")}
              onClick={() => downloadCsv("pt-tasks", tasks.map((t) => ({
                title: t.title, detail: t.detail ?? "", type: t.task_type ?? "general", priority: t.priority,
                status: t.status, due: t.due_at ?? "", client: t.client_user_id ? people[t.client_user_id]?.name ?? "" : "",
                assigned: trainerName[t.instructor_id ?? ""] ?? "", recurrence: t.recurrence,
                completed_at: t.completed_at ?? "",
              })))}
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button className={ptButtonClass("primary")} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New task
            </button>
          </>
        }
      />

      <PTCard padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-pt-line px-3 py-2">
          <div className="flex rounded-lg border border-pt-line overflow-hidden">
            {([["list", List], ["board", LayoutGrid], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm capitalize transition-colors ${view === v ? "bg-pt-noir text-pt-cream" : "bg-white text-pt-muted hover:text-pt-ink"}`}
              >
                <Icon className="h-4 w-4" /> {v}
              </button>
            ))}
          </div>

          <Select value={filterTrainer} onValueChange={setFilterTrainer}>
            <SelectTrigger className="h-9 w-44 border-pt-line bg-white"><SelectValue placeholder="Staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-40 border-pt-line bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PT_TASK_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-9 w-36 border-pt-line bg-white"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-sm text-pt-muted ml-auto">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
          </label>
        </div>

        {view === "list" && (
          <PTTable
            columns={columns}
            rows={tasks}
            loading={isLoading}
            getRowKey={(t) => t.id}
            onRowClick={(t) => t.client_user_id && navigate(`/admin/pt/clients/${t.client_user_id}`)}
            empty={<PTEmptyState icon={ListChecks} title="No tasks" description="Create a task to track follow-ups, check-ins and admin work." />}
          />
        )}

        {view === "board" && (
          <div className="grid gap-3 p-3 md:grid-cols-3">
            {PT_TASK_STATUSES.map((status) => {
              const column = tasks.filter((t) => (t.status || "todo") === status);
              return (
                <div key={status} className="rounded-xl border border-pt-line bg-pt-cream/40 p-2">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <span className="text-sm font-medium text-pt-ink">{STATUS_LABEL[status]}</span>
                    <span className="text-xs text-pt-muted">{column.length}</span>
                  </div>
                  <div className="space-y-2">
                    {column.map((t) => (
                      <div key={t.id} className="rounded-lg border border-pt-line bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm text-pt-ink">{t.title}</div>
                          <PTBadge tone={priorityTone(t.priority) as any}><span className="capitalize">{t.priority}</span></PTBadge>
                        </div>
                        {t.client_user_id && <div className="text-xs text-pt-muted mt-1">{people[t.client_user_id]?.name ?? "—"}</div>}
                        {t.due_at && <div className="text-xs text-pt-muted">Due {fmtDate(new Date(t.due_at), "MMM d, h:mm a")}</div>}
                        <div className="mt-2 flex gap-1">
                          {PT_TASK_STATUSES.filter((s) => s !== status).map((s) => (
                            <button
                              key={s}
                              onClick={() => update.mutate({ id: t.id, patch: { status: s, completed_at: s === "done" ? new Date().toISOString() : null } })}
                              className="rounded-md border border-pt-line px-2 py-0.5 text-[11px] text-pt-muted hover:border-pt-gold hover:text-pt-ink"
                            >
                              → {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!column.length && <div className="px-1 py-6 text-center text-xs text-pt-muted">Nothing here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "calendar" && (
          <div className="p-3">
            <div className="flex items-center justify-between pb-3">
              <button className={ptButtonClass("outline")} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
              <div className="font-serif text-lg text-pt-ink">{fmtDate(month, "MMMM yyyy")}</div>
              <button className={ptButtonClass("outline")} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-px rounded-xl border border-pt-line bg-pt-line overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-pt-noir py-1.5 text-center text-[11px] uppercase tracking-wide text-pt-cream">{d}</div>
              ))}
              {calendarDays.map((day) => {
                const dayTasks = tasks.filter((t) => t.due_at && isSameDay(new Date(t.due_at), day));
                return (
                  <div key={day.toISOString()} className={`min-h-[104px] bg-white p-1.5 ${isSameMonth(day, month) ? "" : "opacity-50"}`}>
                    <div className={`text-xs mb-1 ${isSameDay(day, new Date()) ? "font-semibold text-pt-gold" : "text-pt-muted"}`}>{fmtDate(day, "d")}</div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className={`rounded px-1.5 py-0.5 text-[11px] truncate ${t.completed_at ? "bg-pt-cream text-pt-muted line-through" : "bg-pt-cream text-pt-ink"}`} title={t.title}>
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && <div className="text-[11px] text-pt-muted">+{dayTasks.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PTCard>

      <CreateTaskModal
        open={createOpen}
        onClose={closeCreate}
        pending={create.isPending}
        trainers={trainers}
        onSubmit={async (payload) => { await create.mutateAsync(payload); closeCreate(); }}
      />

      <PTConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Delete task?"
        description="This permanently removes the task."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmId) remove.mutate(confirmId); setConfirmId(null); }}
      />
    </PTShell>
  );
}

function CreateTaskModal({
  open, onClose, onSubmit, pending, trainers,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<PTTaskRow>) => Promise<void>;
  pending: boolean;
  trainers: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState("medium");
  const [type, setType] = useState("general");
  const [dueAt, setDueAt] = useState("");
  const [instructorId, setInstructorId] = useState("none");
  const [recurrence, setRecurrence] = useState("none");
  const [interval, setInterval] = useState("1");
  const [until, setUntil] = useState("");

  async function submit() {
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(),
      detail: detail.trim() || null,
      priority,
      task_type: type,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      instructor_id: instructorId === "none" ? null : instructorId,
      recurrence,
      recurrence_interval: Math.max(1, Number(interval) || 1),
      recurrence_until: recurrence !== "none" && until ? until : null,
    } as Partial<PTTaskRow>);
    setTitle(""); setDetail(""); setDueAt(""); setPriority("medium"); setType("general");
    setRecurrence("none"); setInterval("1"); setUntil(""); setInstructorId("none");
  }

  return (
    <PTModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="New task"
      description="Track a follow-up, check-in or admin item."
      size="sm"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button className={ptButtonClass("primary")} onClick={submit} disabled={!title.trim() || pending}>Create task</button>
        </>
      }
    >
      <div className="space-y-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="border-pt-line bg-white" />
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details (optional)" className="border-pt-line bg-white" />
        <div className="grid grid-cols-2 gap-3">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{PT_TASK_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-pt-muted">Due</label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="border-pt-line bg-white" />
          </div>
          <div>
            <label className="text-xs text-pt-muted">Assign to</label>
            <Select value={instructorId} onValueChange={setInstructorId}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-pt-muted">Repeats</label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["none", "daily", "weekly", "monthly"].map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-pt-muted">Every</label>
            <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} disabled={recurrence === "none"} className="border-pt-line bg-white" />
          </div>
          <div>
            <label className="text-xs text-pt-muted">Until</label>
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} disabled={recurrence === "none"} className="border-pt-line bg-white" />
          </div>
        </div>
      </div>
    </PTModal>
  );
}
