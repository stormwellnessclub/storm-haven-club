import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Library } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTBadge, PTEmptyState, PTModal, PTTable, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { PTWorkspaceNav } from "@/components/admin/pt/PTWorkspaceNav";
import { usePTExerciseLibrary, usePTExerciseLibraryMutations } from "@/hooks/pt/usePTProgramBuilder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  name: "", category: "", muscle_group: "", equipment: "", media_url: "",
  cues: "", notes: "", default_sets: 3, default_reps: "10", default_tempo: "", default_rest: "90s",
};

export default function PTLibrary() {
  const { data: library = [], isLoading } = usePTExerciseLibrary();
  const { save, remove } = usePTExerciseLibraryMutations();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return library
      .filter((l: any) => l.is_active !== false)
      .filter((l: any) => !term || [l.name, l.muscle_group, l.equipment, l.category]
        .some((v: string) => (v ?? "").toLowerCase().includes(term)));
  }, [library, q]);

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Programs & Progress"
        title="Workout Library"
        subtitle="Reusable movements with default prescriptions, cues and media."
        actions={
          <button className={ptButtonClass("primary")} onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-1.5" />New exercise
          </button>
        }
      />
      <PTWorkspaceNav />

      <PTCard className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pt-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises, muscle group, equipment"
            className="pl-9 h-9 bg-white border-pt-line text-[13px]" />
        </div>
      </PTCard>

      {rows.length === 0 && !isLoading ? (
        <PTEmptyState icon={Library} title="No exercises yet" description="Add movements you use with clients to speed up program building." />
      ) : (
        <PTCard padded={false}>
          <PTTable
            loading={isLoading}
            rows={rows}
            getRowKey={(r: any) => r.id}
            onRowClick={(r: any) => setEditing(r)}
            columns={[
              { key: "name", header: "Exercise", render: (r: any) => (
                <div>
                  <div className="text-[13px] font-medium text-pt-ink">{r.name}</div>
                  {r.cues && <div className="text-[11px] text-pt-muted truncate max-w-md">{r.cues}</div>}
                </div>
              ) },
              { key: "cat", header: "Category", render: (r: any) => r.category ? <PTBadge>{r.category}</PTBadge> : <span className="text-pt-muted">—</span> },
              { key: "mg", header: "Muscle group", render: (r: any) => r.muscle_group ?? "—" },
              { key: "eq", header: "Equipment", render: (r: any) => r.equipment ?? "—" },
              { key: "def", header: "Default", render: (r: any) => `${r.default_sets ?? "-"} x ${r.default_reps ?? "-"}${r.default_rest ? ` · ${r.default_rest}` : ""}` },
              { key: "act", header: "", align: "right", render: (r: any) => (
                <button className={ptButtonClass("ghost")} onClick={(e) => { e.stopPropagation(); remove.mutate(r.id); }} aria-label="Archive exercise">
                  <Trash2 className="h-3.5 w-3.5 text-pt-red" />
                </button>
              ) },
            ]}
          />
        </PTCard>
      )}

      <PTModal
        open={!!editing} onOpenChange={(v) => !v && setEditing(null)}
        title={editing?.id ? "Edit exercise" : "New exercise"}
        footer={<>
          <button className={ptButtonClass("ghost")} onClick={() => setEditing(null)}>Cancel</button>
          <button className={ptButtonClass("primary")} disabled={!editing?.name?.trim()}
            onClick={() => save.mutate(editing, { onSuccess: () => setEditing(null) })}>Save exercise</button>
        </>}
      >
        {editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label className="pt-eyebrow">Name</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Category</Label>
              <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Muscle group</Label>
              <Input value={editing.muscle_group ?? ""} onChange={(e) => setEditing({ ...editing, muscle_group: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Equipment</Label>
              <Input value={editing.equipment ?? ""} onChange={(e) => setEditing({ ...editing, equipment: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Media URL</Label>
              <Input value={editing.media_url ?? ""} onChange={(e) => setEditing({ ...editing, media_url: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Default sets</Label>
              <Input type="number" value={editing.default_sets ?? 3} onChange={(e) => setEditing({ ...editing, default_sets: Number(e.target.value) })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Default reps</Label>
              <Input value={editing.default_reps ?? ""} onChange={(e) => setEditing({ ...editing, default_reps: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Default tempo</Label>
              <Input value={editing.default_tempo ?? ""} onChange={(e) => setEditing({ ...editing, default_tempo: e.target.value })} className="bg-white border-pt-line" /></div>
            <div><Label className="pt-eyebrow">Default rest</Label>
              <Input value={editing.default_rest ?? ""} onChange={(e) => setEditing({ ...editing, default_rest: e.target.value })} className="bg-white border-pt-line" /></div>
            <div className="sm:col-span-2"><Label className="pt-eyebrow">Trainer cues</Label>
              <Textarea value={editing.cues ?? ""} onChange={(e) => setEditing({ ...editing, cues: e.target.value })} className="bg-white border-pt-line min-h-20" /></div>
            <div className="sm:col-span-2"><Label className="pt-eyebrow">Notes</Label>
              <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="bg-white border-pt-line min-h-20" /></div>
          </div>
        )}
      </PTModal>
    </PTShell>
  );
}
