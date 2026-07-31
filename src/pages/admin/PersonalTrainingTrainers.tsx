import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Trash2, Users, StickyNote, Eye, EyeOff, Calendar, Ban, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { PT_FORMAT_LABEL, PT_FORMATS, PtFormat } from "@/lib/ptFormat";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
  is_public_pt: boolean;
}
interface Availability { id: string; instructor_id: string; weekday: number; start_time: string; end_time: string; }
interface Override { id: string; instructor_id: string; date: string; kind: "block" | "extra"; start_time: string | null; end_time: string | null; note: string | null; }
interface FormatRow { instructor_id: string; format: PtFormat; }
interface Note { id: string; scope: "shared" | "trainer"; instructor_id: string | null; body: string; created_by: string | null; created_at: string; updated_at: string; }

export default function PersonalTrainingTrainers() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ["pt-trainers-list"],
    queryFn: async () => {
      // Email is staff-only; served through the SECURITY DEFINER staff RPC.
      const { data, error } = await (supabase as any).rpc("get_instructors_with_contact");
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((i) => i.is_active)
        .sort((a, b) => String(a.first_name).localeCompare(String(b.first_name))) as Instructor[];
    },
  });

  const { data: packs = [] } = useQuery({
    queryKey: ["pt-packs-visibility-summary"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("pt_packs").select("id, is_public, is_active");
      return (data ?? []) as { id: string; is_public: boolean; is_active: boolean }[];
    },
  });

  const publicPackCount = packs.filter((p) => p.is_public && p.is_active).length;
  const hiddenPackCount = packs.filter((p) => !p.is_public && p.is_active).length;
  const publicTrainerCount = instructors.filter((i) => i.is_public_pt).length;
  const hiddenTrainerCount = instructors.filter((i) => !i.is_public_pt).length;

  async function toggleTrainerPublic(t: Instructor, next: boolean) {
    const { error } = await supabase.from("instructors").update({ is_public_pt: next } as any).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Trainer is now public" : "Trainer hidden from public");
    qc.invalidateQueries({ queryKey: ["pt-trainers-list"] });
  }

  const selected = instructors.find((i) => i.id === selectedId) ?? null;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" /> PT Trainers
            </h1>
            <p className="text-sm text-muted-foreground">
              Availability, formats, notes, and per-trainer public visibility.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/admin/personal-training/schedule">Schedule</Link></Button>
            <Button variant="outline" asChild><Link to="/admin/personal-training/passes">Customers &amp; Packs</Link></Button>
            <Button variant="outline" asChild><Link to="/admin/personal-training/packs">Packs &amp; Pricing</Link></Button>
          </div>
        </div>

        {/* Publishing summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SummaryCard label="Public trainers" value={publicTrainerCount} icon={<Eye className="h-4 w-4" />} tone="ok" />
          <SummaryCard label="Hidden trainers" value={hiddenTrainerCount} icon={<EyeOff className="h-4 w-4" />} />
          <SummaryCard label="Public packs" value={publicPackCount} icon={<Eye className="h-4 w-4" />} tone="ok" />
          <SummaryCard label="Hidden packs" value={hiddenPackCount} icon={<EyeOff className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shared notes */}
          <section className="lg:col-span-1 order-2 lg:order-1">
            <SharedNotesBoard />
          </section>

          {/* Trainer list */}
          <section className="lg:col-span-2 order-1 lg:order-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Trainers</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : instructors.length === 0 ? (
              <div className="border border-dashed rounded-lg py-16 text-center text-sm text-muted-foreground">
                No active instructors. Add trainers in Admin → Instructors.
              </div>
            ) : (
              <div className="border rounded-lg bg-card divide-y">
                {instructors.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                    <button onClick={() => setSelectedId(t.id)} className="flex-1 min-w-0 text-left hover:opacity-80">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.first_name} {t.last_name}</span>
                        {t.is_public_pt ? (
                          <Badge variant="secondary" className="text-[10px] gap-1"><Eye className="h-3 w-3" /> Public</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1"><EyeOff className="h-3 w-3" /> Hidden</Badge>
                        )}
                      </div>
                      {t.email && <div className="text-xs text-muted-foreground truncate">{t.email}</div>}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label htmlFor={`pub-${t.id}`} className="text-xs text-muted-foreground">Public</Label>
                      <Switch id={`pub-${t.id}`} checked={t.is_public_pt} onCheckedChange={(v) => toggleTrainerPublic(t, v)} />
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(t.id)}>Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <TrainerDetailSheet
        trainer={selected}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelectedId(null); }}
      />
    </AdminLayout>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "ok" }) {
  return (
    <div className={`rounded-lg border p-4 bg-card ${tone === "ok" ? "border-primary/30" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

/* ---------------- Shared notes ---------------- */

function SharedNotesBoard() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["pt-notes-shared"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_notes").select("*").eq("scope", "shared").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_notes").insert({
        scope: "shared", instructor_id: null, body: body.trim(), created_by: user?.id ?? null,
      });
      if (error) throw error;
      setBody("");
      qc.invalidateQueries({ queryKey: ["pt-notes-shared"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await (supabase as any).from("pt_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-notes-shared"] });
  }

  return (
    <div className="border rounded-lg bg-card">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <StickyNote className="h-4 w-4" />
        <h2 className="font-serif text-lg">PT notes</h2>
        <span className="text-xs text-muted-foreground ml-auto">Admin-only</span>
      </div>
      <div className="p-3 space-y-2 border-b">
        <Textarea rows={3} placeholder="Anything you need to remember…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={saving || !body.trim()}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Add note
          </Button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No notes yet.</div>
        ) : notes.map((n) => (
          <div key={n.id} className="px-4 py-3 border-b last:border-0 group">
            <div className="text-sm whitespace-pre-wrap">{n.body}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">{fmtDate(parseISO(n.created_at), "MMM d, yyyy · h:mm a")}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto opacity-0 group-hover:opacity-100"
                onClick={() => remove(n.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Trainer detail sheet ---------------- */

function TrainerDetailSheet({
  trainer, open, onOpenChange,
}: { trainer: Instructor | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {trainer && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> {trainer.first_name} {trainer.last_name}
              </SheetTitle>
              <SheetDescription>{trainer.email}</SheetDescription>
            </SheetHeader>
            <Tabs defaultValue="availability" className="mt-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="availability"><Calendar className="h-3.5 w-3.5 mr-1" />Availability</TabsTrigger>
                <TabsTrigger value="overrides"><Ban className="h-3.5 w-3.5 mr-1" />Overrides</TabsTrigger>
                <TabsTrigger value="formats">Formats</TabsTrigger>
                <TabsTrigger value="notes"><StickyNote className="h-3.5 w-3.5 mr-1" />Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="availability" className="pt-4"><AvailabilityEditor trainer={trainer} /></TabsContent>
              <TabsContent value="overrides" className="pt-4"><OverridesEditor trainer={trainer} /></TabsContent>
              <TabsContent value="formats" className="pt-4"><FormatsEditor trainer={trainer} /></TabsContent>
              <TabsContent value="notes" className="pt-4"><TrainerNotes trainer={trainer} /></TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* Availability */
function AvailabilityEditor({ trainer }: { trainer: Instructor }) {
  const qc = useQueryClient();
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-availability", trainer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_trainer_availability")
        .select("*").eq("instructor_id", trainer.id)
        .order("weekday").order("start_time");
      if (error) throw error;
      return (data ?? []) as Availability[];
    },
  });

  async function add() {
    if (end <= start) return toast.error("End time must be after start");
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("pt_trainer_availability").insert({
        instructor_id: trainer.id, weekday, start_time: start, end_time: end,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["pt-availability", trainer.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("pt_trainer_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-availability", trainer.id] });
  }

  const grouped = useMemo(() => {
    const m: Record<number, Availability[]> = {};
    rows.forEach((r) => { (m[r.weekday] ||= []).push(r); });
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
        <div className="text-xs font-medium">Add weekly window</div>
        <div className="grid grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">Day</Label>
            <Select value={String(weekday)} onValueChange={(v) => setWeekday(parseInt(v, 10))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <Button size="sm" onClick={add} disabled={saving}><Plus className="h-3 w-3 mr-1" />Add</Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div> :
        rows.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No availability set.</div> :
        <div className="border rounded-md divide-y">
          {WEEKDAYS.map((d, i) => (grouped[i] ?? []).length === 0 ? null : (
            <div key={i} className="px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">{d}</div>
              {(grouped[i] ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1">
                  <span className="tabular-nums">{a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      }
    </div>
  );
}

/* Overrides */
function OverridesEditor({ trainer }: { trainer: Instructor }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [kind, setKind] = useState<"block" | "extra">("block");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-overrides", trainer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_trainer_overrides")
        .select("*").eq("instructor_id", trainer.id).order("date");
      if (error) throw error;
      return (data ?? []) as Override[];
    },
  });

  async function add() {
    setSaving(true);
    try {
      const payload: any = { instructor_id: trainer.id, date, kind, note: note.trim() || null };
      if (kind === "extra") {
        if (end <= start) return toast.error("End time must be after start");
        payload.start_time = start; payload.end_time = end;
      }
      const { error } = await (supabase as any).from("pt_trainer_overrides").insert(payload);
      if (error) throw error;
      setNote("");
      qc.invalidateQueries({ queryKey: ["pt-overrides", trainer.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("pt_trainer_overrides").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-overrides", trainer.id] });
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
        <div className="text-xs font-medium">Add override (time off or extra window)</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block (time off)</SelectItem>
                <SelectItem value="extra">Extra window</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {kind === "extra" && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label className="text-xs">End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
        )}
        <div>
          <Label className="text-xs">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Vacation" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={saving}><Plus className="h-3 w-3 mr-1" />Add override</Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div> :
        rows.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No overrides.</div> :
        <div className="border rounded-md divide-y">
          {rows.map((o) => (
            <div key={o.id} className="px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {fmtDate(parseISO(o.date), "EEE, MMM d, yyyy")}
                  <Badge variant={o.kind === "block" ? "destructive" : "secondary"} className="ml-2 text-[10px]">
                    {o.kind === "block" ? "Blocked" : "Extra"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.kind === "extra" && o.start_time && o.end_time && `${o.start_time.slice(0, 5)} – ${o.end_time.slice(0, 5)}`}
                  {o.note && ` · ${o.note}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

/* Formats */
function FormatsEditor({ trainer }: { trainer: Instructor }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-formats", trainer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_trainer_formats")
        .select("*").eq("instructor_id", trainer.id);
      if (error) throw error;
      return (data ?? []) as FormatRow[];
    },
  });

  const active = new Set(rows.map((r) => r.format));

  async function toggle(f: PtFormat, next: boolean) {
    setSaving(true);
    try {
      if (next) {
        const { error } = await (supabase as any).from("pt_trainer_formats").insert({ instructor_id: trainer.id, format: f });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await (supabase as any).from("pt_trainer_formats").delete()
          .eq("instructor_id", trainer.id).eq("format", f);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["pt-formats", trainer.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  }

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Which formats this trainer teaches.</p>
      {PT_FORMATS.map((f) => (
        <label key={f} className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/50">
          <Checkbox checked={active.has(f)} onCheckedChange={(v) => toggle(f, !!v)} disabled={saving} />
          <span className="text-sm font-medium">{PT_FORMAT_LABEL[f]}</span>
        </label>
      ))}
    </div>
  );
}

/* Per-trainer notes */
function TrainerNotes({ trainer }: { trainer: Instructor }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["pt-notes-trainer", trainer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_notes")
        .select("*").eq("scope", "trainer").eq("instructor_id", trainer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_notes").insert({
        scope: "trainer", instructor_id: trainer.id, body: body.trim(), created_by: user?.id ?? null,
      });
      if (error) throw error;
      setBody("");
      qc.invalidateQueries({ queryKey: ["pt-notes-trainer", trainer.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await (supabase as any).from("pt_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pt-notes-trainer", trainer.id] });
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
        <Textarea rows={3} placeholder={`Notes about ${trainer.first_name}…`} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={saving || !body.trim()}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Add note
          </Button>
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div> :
        notes.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No notes yet.</div> :
        <div className="border rounded-md divide-y">
          {notes.map((n) => (
            <div key={n.id} className="px-3 py-2 group">
              <div className="text-sm whitespace-pre-wrap">{n.body}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">{fmtDate(parseISO(n.created_at), "MMM d, yyyy · h:mm a")}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto opacity-0 group-hover:opacity-100"
                  onClick={() => remove(n.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
