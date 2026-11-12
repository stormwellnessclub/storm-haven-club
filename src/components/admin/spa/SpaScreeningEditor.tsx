import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScreeningQuestions } from "@/hooks/useAellaSculptForms";
import { useSpaTreatmentZones } from "@/hooks/useSpaTreatmentZones";
import { activeZones } from "@/lib/spaZones";
import { answerChoices, type AnswerType, type ScreeningQuestion } from "@/lib/aellaSculptForms";

const TYPES: { value: AnswerType; label: string }[] = [
  { value: "yes_no", label: "Yes / No" },
  { value: "yes_no_unsure", label: "Yes / No / Not Sure" },
  { value: "multi", label: "Pick any that apply" },
  { value: "text", label: "Written answer" },
];

function useSaveQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Partial<ScreeningQuestion> & { id?: string }) => {
      const t = supabase.from as any;
      const row = { ...q, updated_at: new Date().toISOString() };
      const { error } = q.id ? await t("spa_screening_questions").update(row).eq("id", q.id) : await t("spa_screening_questions").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa-screening-questions"] }); toast.success("Question saved"); },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });
}

function Chips({ choices, value, onChange, tone }: { choices: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; tone?: "destructive" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      {choices.map((c) => {
        const on = value.includes(c.value);
        return (
          <button key={c.value} type="button" onClick={() => onChange(on ? value.filter((v) => v !== c.value) : [...value, c.value])}>
            <Badge variant={on ? (tone ?? "default") : "outline"}>{c.label}</Badge>
          </button>
        );
      })}
    </div>
  );
}

function QuestionEditor({ q, all, zones, onDone }: { q: Partial<ScreeningQuestion>; all: ScreeningQuestion[]; zones: { id: string; name: string }[]; onDone?: () => void }) {
  const save = useSaveQuestion();
  const [d, setD] = useState<Partial<ScreeningQuestion>>(q);
  useEffect(() => setD(q), [q]);
  const set = (p: Partial<ScreeningQuestion>) => setD((x) => ({ ...x, ...p }));
  const choices = answerChoices({ answer_type: (d.answer_type ?? "yes_no") as AnswerType, options: d.options ?? null });
  const parent = all.find((x) => x.id === d.parent_id);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Section</p>
          <Input value={d.section ?? ""} onChange={(e) => set({ section: e.target.value })} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Short title (optional)</p>
          <Input value={d.title ?? ""} onChange={(e) => set({ title: e.target.value || null })} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Answer type</p>
          <Select value={d.answer_type ?? "yes_no"} onValueChange={(v) => set({ answer_type: v as AnswerType })} disabled={!!q.id}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Question wording</p>
        <Textarea rows={2} value={d.prompt ?? ""} onChange={(e) => set({ prompt: e.target.value })} />
      </div>
      {d.answer_type === "multi" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Choices (one per line)</p>
            <Textarea rows={4} value={(d.options ?? []).join("\n")} onChange={(e) => set({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">"None" choice that clears the others (optional)</p>
            <Input value={d.exclusive_option ?? ""} onChange={(e) => set({ exclusive_option: e.target.value || null })} />
          </div>
        </div>
      )}
      {d.answer_type !== "text" && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Answers that require provider review</p>
              <Chips choices={choices} value={d.review_on ?? []} onChange={(v) => set({ review_on: v })} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Answers that prevent automatic clearance</p>
              <Chips choices={choices} value={d.hold_on ?? []} onChange={(v) => set({ hold_on: v })} tone="destructive" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Follow-up question for the client (optional)</p>
              <Input value={d.detail_prompt ?? ""} onChange={(e) => set({ detail_prompt: e.target.value || null })} placeholder="e.g. Please describe." />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Ask the follow-up when the answer is</p>
              <Chips choices={choices} value={d.detail_on ?? []} onChange={(v) => set({ detail_on: v })} />
            </div>
          </div>
        </>
      )}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Review applies to these treatment areas (none selected = every area)</p>
        <Chips choices={zones.map((z) => ({ value: z.id, label: z.name }))} value={d.zone_ids ?? []} onChange={(v) => set({ zone_ids: v.length ? v : null })} />
      </div>
      {parent && <p className="text-xs text-muted-foreground">Shown only when "{parent.title ?? parent.prompt}" is answered {(d.show_when ?? []).join(" / ")}.</p>}
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.is_required ?? true} onCheckedChange={(v) => set({ is_required: v })} />Required</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.is_active ?? true} onCheckedChange={(v) => set({ is_active: v })} />Active</label>
        <label className="flex items-center gap-2 text-sm">Order <Input type="number" className="h-8 w-20" value={d.sort_order ?? 0} onChange={(e) => set({ sort_order: Number(e.target.value) || 0 })} /></label>
        <div className="ml-auto flex gap-2">
          {onDone && <Button size="sm" variant="ghost" onClick={onDone}>Close</Button>}
          <Button size="sm" disabled={!d.prompt?.trim() || !d.section?.trim() || save.isPending || (d.answer_type === "multi" && !(d.options ?? []).length)}
            onClick={async () => {
              const { id, service_key, section, title, prompt, answer_type, options, exclusive_option, detail_prompt, detail_on, review_on, hold_on, zone_ids, is_required, is_active, sort_order } = d;
              await save.mutateAsync({ id, service_key, section: section!.trim(), title, prompt: prompt!.trim(), answer_type, options: answer_type === "multi" ? options : null,
                exclusive_option: answer_type === "multi" ? exclusive_option : null, detail_prompt, detail_on: detail_on ?? [], review_on: review_on ?? [], hold_on: hold_on ?? [],
                zone_ids, is_required, is_active, sort_order });
              onDone?.();
            }}>Save question</Button>
        </div>
      </div>
    </div>
  );
}

/** Managers edit the screening questions and which answers need provider review or block automatic clearance. */
export function SpaScreeningEditor({ serviceKey }: { serviceKey: string }) {
  const { data: questions = [], isLoading } = useScreeningQuestions(serviceKey, true);
  const { data: zoneRows = [] } = useSpaTreatmentZones();
  const zones = activeZones(zoneRows, serviceKey);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nextOrder = (questions[questions.length - 1]?.sort_order ?? 0) + 10;
  return (
    <div className="mt-8">
      <h4 className="font-semibold">First-visit screening questions</h4>
      <p className="mb-3 text-xs text-muted-foreground">
        Clients answer these on the Health &amp; Treatment Intake. A "provider review" answer marks Provider Review as Required; a "prevents automatic clearance" answer also means the client is not cleared until a provider records a decision. Keep these in line with the equipment instructions and medical-director guidance.
      </p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-1.5">
          {questions.map((q) => open === q.id ? (
            <QuestionEditor key={q.id} q={q} all={questions} zones={zones} onDone={() => setOpen(null)} />
          ) : (
            <button key={q.id} type="button" onClick={() => setOpen(q.id)} className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 ${q.is_active ? "" : "opacity-50"} ${q.parent_id ? "ml-6 w-[calc(100%-1.5rem)]" : ""}`}>
              <span className="w-28 shrink-0 text-xs text-muted-foreground">{q.section}</span>
              <span className="flex-1">{q.title ? <strong>{q.title}: </strong> : null}{q.prompt}</span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {!q.is_active && <Badge variant="outline">Off</Badge>}
                {q.hold_on.length > 0 && <Badge variant="destructive">Blocks auto-clear</Badge>}
                {q.review_on.length > 0 && <Badge variant="secondary">Review</Badge>}
                {q.zone_ids?.length ? <Badge variant="outline">Some areas</Badge> : null}
              </span>
            </button>
          ))}
          {adding ? (
            <QuestionEditor q={{ service_key: serviceKey, section: "Health screening", answer_type: "yes_no", review_on: [], hold_on: [], detail_on: [], is_required: true, is_active: true, sort_order: nextOrder }}
              all={questions} zones={zones} onDone={() => setAdding(false)} />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add a question</Button>
          )}
        </div>
      )}
    </div>
  );
}
