import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, CheckCircle2, RotateCcw, NotebookPen, History } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  PTShell, PTPageHeader, PTCard, PTBadge, PTSectionTitle, PTEmptyState, PTModal, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { PTWorkspaceNav } from "@/components/admin/pt/PTWorkspaceNav";
import {
  usePTSessionNotesList, usePTSessionNoteMutations, usePTNoteAutosave, usePTSessionContext,
} from "@/hooks/pt/usePTSessionNotes";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PTSessionNotes() {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | undefined>(params.get("note") ?? undefined);
  const [newOpen, setNewOpen] = useState(false);

  const { data: notes = [], isLoading } = usePTSessionNotesList();
  const { data: directory = [] } = usePTClientDirectory();
  const { create, remove } = usePTSessionNoteMutations();

  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    directory.forEach((c: any) => { map[c.userId] = c.name; });
    return map;
  }, [directory]);

  useEffect(() => { if (!selectedId && notes.length) setSelectedId(notes[0].id); }, [notes, selectedId]);

  const note = notes.find((n) => n.id === selectedId) ?? null;
  const { draft, setField, state, finalize, reopen } = usePTNoteAutosave(note);
  const { data: ctx } = usePTSessionContext(draft?.user_id, draft?.id);

  const select = (id: string) => { setSelectedId(id); setParams({ note: id }); };

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Programs & Progress"
        title="Session Notes"
        subtitle="Structured SOAP-style notes that autosave as drafts."
        actions={
          <button className={ptButtonClass("primary")} onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />New session note
          </button>
        }
      />
      <PTWorkspaceNav />

      <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
        <div>
          <PTSectionTitle>Recent notes</PTSectionTitle>
          <PTCard padded={false}>
            {isLoading ? (
              <div className="p-4 text-[13px] text-pt-muted">Loading…</div>
            ) : notes.length === 0 ? (
              <div className="p-4"><PTEmptyState title="No notes yet" description="Create a note after a session." /></div>
            ) : (
              <ul className="divide-y divide-pt-line/70 max-h-[70vh] overflow-y-auto pt-scroll">
                {notes.map((n) => (
                  <li key={n.id}>
                    <button onClick={() => select(n.id)}
                      className={cn("w-full text-left px-4 py-3 hover:bg-pt-beige/40", selectedId === n.id && "bg-pt-beige/60")}>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-pt-ink truncate">{nameOf[n.user_id] ?? "Client"}</span>
                        {n.is_draft && <PTBadge tone="amber">Draft</PTBadge>}
                      </div>
                      <div className="text-[11px] text-pt-muted">{format(new Date(`${n.session_date}T12:00:00`), "EEE MMM d, yyyy")}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PTCard>
        </div>

        {!draft ? (
          <PTEmptyState icon={NotebookPen} title="Select a note" description="Choose a session note or start a new one." />
        ) : (
          <div className="space-y-4">
            <PTCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="pt-serif text-xl text-pt-ink">{nameOf[draft.user_id] ?? "Client"}</div>
                  <div className="text-[12px] text-pt-muted">
                    {format(new Date(`${draft.session_date}T12:00:00`), "EEEE, MMMM d, yyyy")} ·{" "}
                    {state === "saving" ? "Saving…" : state === "saved" ? "All changes saved" : state === "error" ? "Save failed" : draft.is_draft ? "Draft" : "Finalized"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {draft.is_draft ? (
                    <button className={ptButtonClass("primary")} onClick={finalize}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />Finalize note
                    </button>
                  ) : (
                    <button className={ptButtonClass("outline")} onClick={reopen}>
                      <RotateCcw className="h-4 w-4 mr-1.5" />Reopen draft
                    </button>
                  )}
                  <button className={ptButtonClass("ghost")}
                    onClick={() => remove.mutate(draft.id, { onSuccess: () => setSelectedId(undefined) })}>
                    <Trash2 className="h-4 w-4 text-pt-red" />
                  </button>
                </div>
              </div>
            </PTCard>

            <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
              <PTCard>
                <div className="grid gap-3">
                  <Field label="Subjective (client report)" value={draft.subjective} onChange={(v) => setField("subjective", v)} rows={3} />
                  <Field label="Objective (what was performed)" value={draft.objective} onChange={(v) => setField("objective", v)} rows={3} />
                  <Field label="Trainer observations" value={draft.observations} onChange={(v) => setField("observations", v)} rows={3} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mobility issues" value={draft.mobility_issues} onChange={(v) => setField("mobility_issues", v)} rows={2} />
                    <Field label="Pain or discomfort" value={draft.pain_discomfort} onChange={(v) => setField("pain_discomfort", v)} rows={2} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="pt-eyebrow">Energy level (1-10)</span>
                      <Input type="number" min={1} max={10} value={draft.energy_level ?? ""}
                        onChange={(e) => setField("energy_level", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 bg-white border-pt-line text-[13px] mt-0.5" /></label>
                    <label className="block"><span className="pt-eyebrow">Session RPE (1-10)</span>
                      <Input type="number" min={1} max={10} step="0.5" value={draft.rpe ?? ""}
                        onChange={(e) => setField("rpe", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 bg-white border-pt-line text-[13px] mt-0.5" /></label>
                  </div>
                  <Field label="Modifications" value={draft.modifications} onChange={(v) => setField("modifications", v)} rows={2} />
                  <Field label="Homework" value={draft.homework} onChange={(v) => setField("homework", v)} rows={2} />
                  <Field label="Next-session focus" value={draft.next_focus} onChange={(v) => setField("next_focus", v)} rows={2} />
                  <Field label="Private trainer notes (staff only)" value={draft.private_note} onChange={(v) => setField("private_note", v)} rows={3} />
                </div>
              </PTCard>

              <div className="space-y-4">
                <PTCard>
                  <PTSectionTitle>Reference</PTSectionTitle>
                  <div className="space-y-3 text-[13px]">
                    <div>
                      <div className="pt-eyebrow flex items-center gap-1"><History className="h-3 w-3" />Previous session</div>
                      {ctx?.previous ? (
                        <div className="text-pt-ink mt-1">
                          <div className="text-[12px] text-pt-muted">{ctx.previous.session_date}</div>
                          <p className="line-clamp-4">{ctx.previous.next_focus || ctx.previous.objective || ctx.previous.subjective || "No detail recorded"}</p>
                        </div>
                      ) : <p className="text-pt-muted mt-1">No previous note.</p>}
                    </div>
                    <div>
                      <div className="pt-eyebrow">Restrictions</div>
                      <p className="text-pt-ink mt-1">{ctx?.profile?.injuries || ctx?.profile?.medical_notes || "None recorded"}</p>
                    </div>
                    <div>
                      <div className="pt-eyebrow">Current program</div>
                      <p className="text-pt-ink mt-1">{ctx?.programs?.[0]?.name ?? "No active program"}</p>
                    </div>
                    <div>
                      <div className="pt-eyebrow">Last personal records</div>
                      {ctx?.prs?.length ? (
                        <ul className="mt-1 space-y-0.5">
                          {ctx.prs.slice(0, 4).map((p: any) => (
                            <li key={p.id} className="text-pt-ink">{p.exercise} — {p.weight_lbs} lb{p.reps ? ` x ${p.reps}` : ""}</li>
                          ))}
                        </ul>
                      ) : <p className="text-pt-muted mt-1">No confirmed PRs.</p>}
                    </div>
                  </div>
                </PTCard>

                {!!ctx?.lastLoads?.length && (
                  <PTCard>
                    <PTSectionTitle>Programmed loads</PTSectionTitle>
                    <ul className="space-y-1 text-[13px] max-h-64 overflow-y-auto pt-scroll">
                      {ctx.lastLoads.slice(0, 20).map((l, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate text-pt-ink">{l.exercise}</span>
                          <span className="text-pt-muted shrink-0">{l.sets ?? "-"}x{l.reps ?? "-"}{l.load ? ` @ ${l.load}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </PTCard>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <NewNoteModal
        open={newOpen} onOpenChange={setNewOpen} clients={directory}
        onCreate={(userId, date) => create.mutate({ user_id: userId, session_date: date }, {
          onSuccess: (n) => { select(n.id); setNewOpen(false); },
        })}
      />
    </PTShell>
  );
}

function Field({ label, value, onChange, rows = 3 }: { label: string; value: string | null; onChange: (v: string | null) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="pt-eyebrow">{label}</span>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        rows={rows} className="bg-white border-pt-line text-[13px] mt-0.5" />
    </label>
  );
}

function NewNoteModal({ open, onOpenChange, clients, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; clients: any[]; onCreate: (userId: string, date: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <PTModal
      open={open} onOpenChange={onOpenChange} title="New session note"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!userId} onClick={() => onCreate(userId, date)}>Create draft</button>
      </>}
    >
      <div className="space-y-3">
        <div><Label className="pt-eyebrow">Client</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50 max-h-72">
              {clients.map((c: any) => <SelectItem key={c.userId} value={c.userId}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="pt-eyebrow">Session date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white border-pt-line" /></div>
      </div>
    </PTModal>
  );
}
