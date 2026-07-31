import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format as fmtDate, isBefore } from "date-fns";
import { ListChecks, Plus, Check, Trash2 } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTTabs,
  PTModal, ptButtonClass, PTConfirmDialog,
} from "@/components/admin/pt/PTUI";
import { usePTTasks, usePTTaskMutations, usePTPeople, PTTask } from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tab = "open" | "all";

export default function PTTasks() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("open");
  const [createOpen, setCreateOpen] = useState(params.get("new") === "1");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");

  const { data: tasks = [], isLoading } = usePTTasks(tab === "all");
  const { create, toggle, remove } = usePTTaskMutations();
  const { data: people = {} } = usePTPeople(tasks.map((t) => t.client_user_id).filter(Boolean) as string[]);

  const openCount = useMemo(() => tasks.filter((t) => !t.completed_at).length, [tasks]);

  function closeCreate() {
    setCreateOpen(false);
    if (params.get("new")) { params.delete("new"); setParams(params, { replace: true }); }
  }

  async function submit() {
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      detail: detail.trim() || null,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    } as any);
    setTitle(""); setDetail(""); setDueAt(""); setPriority("medium");
    closeCreate();
  }

  const columns: PTColumn<PTTask>[] = [
    {
      key: "done",
      header: "",
      className: "w-10",
      render: (t) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle.mutate({ id: t.id, done: !t.completed_at }); }}
          className={`h-5 w-5 rounded-md border grid place-items-center transition-colors ${
            t.completed_at ? "bg-pt-green border-pt-green text-white" : "border-pt-line hover:border-pt-gold"
          }`}
          aria-label={t.completed_at ? "Mark incomplete" : "Mark complete"}
        >
          {t.completed_at && <Check className="h-3 w-3" />}
        </button>
      ),
    },
    {
      key: "title",
      header: "Task",
      render: (t) => (
        <div className="min-w-0">
          <div className={t.completed_at ? "line-through text-pt-muted" : "text-pt-ink"}>{t.title}</div>
          {t.detail && <div className="text-xs text-pt-muted line-clamp-1">{t.detail}</div>}
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (t) => (t.client_user_id ? people[t.client_user_id]?.name ?? "—" : "—"),
    },
    { key: "type", header: "Type", render: (t) => <span className="capitalize">{(t.task_type || "general").replace(/_/g, " ")}</span> },
    {
      key: "priority",
      header: "Priority",
      render: (t) => (
        <PTBadge tone={t.priority === "urgent" ? "red" : t.priority === "high" ? "amber" : "neutral"}>
          <span className="capitalize">{t.priority}</span>
        </PTBadge>
      ),
    },
    {
      key: "due",
      header: "Due",
      render: (t) => {
        if (!t.due_at) return "—";
        const overdue = !t.completed_at && isBefore(new Date(t.due_at), new Date());
        return (
          <span className={overdue ? "text-pt-red font-medium" : ""}>
            {fmtDate(new Date(t.due_at), "MMM d, h:mm a")}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirmId(t.id); }}
          className="text-pt-muted hover:text-pt-red transition-colors"
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Operations"
        title="Tasks"
        subtitle={`${openCount} open ${openCount === 1 ? "task" : "tasks"} across the team.`}
        actions={
          <button className={ptButtonClass("primary")} onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </button>
        }
      />
      <PTCard padded={false}>
        <div className="px-3 pt-1">
          <PTTabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]}
          />
        </div>
        <PTTable
          columns={columns}
          rows={tasks}
          loading={isLoading}
          getRowKey={(t) => t.id}
          onRowClick={(t) => t.client_user_id && navigate(`/admin/pt/clients/${t.client_user_id}`)}
          empty={<PTEmptyState icon={ListChecks} title="No tasks" description="Create a task to track follow-ups, check-ins and admin work." />}
        />
      </PTCard>

      <PTModal
        open={createOpen}
        onOpenChange={(v) => (v ? setCreateOpen(true) : closeCreate())}
        title="New task"
        description="Track a follow-up, check-in or admin item."
        size="sm"
        footer={
          <>
            <button className={ptButtonClass("outline")} onClick={closeCreate}>Cancel</button>
            <button className={ptButtonClass("primary")} onClick={submit} disabled={!title.trim() || create.isPending}>
              Create task
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="border-pt-line bg-white" />
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details (optional)" className="border-pt-line bg-white" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="border-pt-line bg-white" />
          </div>
        </div>
      </PTModal>

      <PTConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Delete this task?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmId) remove.mutate(confirmId); setConfirmId(null); }}
      />
    </PTShell>
  );
}
