import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Copy, Play, Trash2, Plus, Check, X, Bell, BellRing, Flame, Dumbbell, Sparkles,
  CalendarCheck, Footprints, Moon, Lightbulb, Settings2, ArrowRightLeft, Wand2,
} from "lucide-react";
import { addDaysISO, detroitTodayISO, weekDays, weekStartISO } from "@/lib/workoutJournal";
import {
  RECOVERY, OTHER, HABITS, REMINDER_OPTIONS, STARTER_WEEKS, activityByKey, reminderAt, suggestions,
  weekStats, weekStreak, detroitWallToUtc, type Activity,
} from "@/lib/weekPlanner";
import {
  useWorkoutPlan, usePlanMutations, usePlanHistory, useWeekBookings, useDayCheckins, useReminderPrefs, PlanEntry,
} from "@/hooks/useWorkoutJournal";
import type { WorkoutTemplate } from "@/hooks/useWorkoutTemplates";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  training: "bg-primary", class: "bg-accent", recovery: "bg-gold", cardio: "bg-muted", rest: "bg-secondary", spa: "bg-gold",
};
const ICON: Record<string, typeof Dumbbell> = {
  training: Dumbbell, class: CalendarCheck, recovery: Sparkles, cardio: Footprints, rest: Moon, spa: Sparkles,
};
const fmtTime = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dayLabel = (d: string, f: string) => format(new Date(`${d}T12:00:00`), f);

type Draft = {
  id?: string; plan_date: string; category: string; activity_key: string | null; template_id: string | null;
  label: string | null; start_time: string; reminder_offset_min: number; duration_min: number | null;
};

export function WeekPlanner({ templates, onStart }: {
  templates: WorkoutTemplate[];
  onStart: (entry: PlanEntry, template: WorkoutTemplate) => void;
}) {
  const today = detroitTodayISO();
  const [start, setStart] = useState(weekStartISO(today));
  const [day, setDay] = useState(today);
  const days = weekDays(start);
  const { data: entries = [] } = useWorkoutPlan(start);
  const { data: history = [] } = usePlanHistory(addDaysISO(weekStartISO(today), -70));
  const { data: booked = [] } = useWeekBookings(start);
  const { checkins, save: saveCheckin } = useDayCheckins(start);
  const { add, update, remove, copyWeek, addMany } = usePlanMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const byId = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const go = (s: string) => { setStart(s); setDay(s === weekStartISO(today) ? today : s); };
  const stats = weekStats(entries);
  const streak = weekStreak(history, weekStartISO(today));
  const tips = suggestions(entries, start, today);
  const dayEntries = entries.filter((e) => e.plan_date === day);
  const dayBooked = booked.filter((b) => b.date === day);
  const checkin = checkins[day];

  // In-app reminder: next planned item today within 90 minutes
  const now = Date.now();
  const upcoming = entries.filter((e) => e.plan_date === today && e.status === "planned" && e.start_time)
    .map((e) => ({ e, at: detroitWallToUtc(today, e.start_time!.slice(0, 5)).getTime() }))
    .filter((x) => x.at > now && x.at - now < 90 * 60_000).sort((a, b) => a.at - b.at)[0];

  const titleOf = (e: PlanEntry) => (e.template_id && byId.get(e.template_id)?.template_name) || e.label || activityByKey(e.activity_key)?.label || "Workout";

  const saveDraft = () => {
    if (!draft) return;
    const time = draft.start_time || null;
    const row: Partial<PlanEntry> & { plan_date: string } = {
      plan_date: draft.plan_date, category: draft.category, activity_key: draft.activity_key, template_id: draft.template_id,
      label: draft.label, start_time: time, duration_min: draft.duration_min,
      reminder_offset_min: draft.reminder_offset_min || null,
      reminder_at: reminderAt(draft.plan_date, time, draft.reminder_offset_min)?.toISOString() ?? null,
    };
    if (draft.id) update.mutate({ id: draft.id, ...row, reminder_sent_at: null } as any);
    else add.mutate(row);
    setDraft(null);
  };
  const newDraft = (p: Partial<Draft>) => setDraft({
    plan_date: day, category: "training", activity_key: null, template_id: null, label: null,
    start_time: "", reminder_offset_min: 0, duration_min: null, ...p,
  });
  const fromActivity = (a: Activity, d = day) => newDraft({ plan_date: d, category: a.category, activity_key: a.key, label: a.label, duration_min: a.minutes ?? null });
  const quickAdd = (a: Activity, d: string) => add.mutate({ plan_date: d, category: a.category, activity_key: a.key, label: a.label, duration_min: a.minutes ?? null });

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => go(addDaysISO(start, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="font-medium">{dayLabel(start, "MMM d")} – {dayLabel(addDaysISO(start, 6), "MMM d")}</p>
          {start !== weekStartISO(today) && <button className="text-xs text-accent underline" onClick={() => go(weekStartISO(today))}>Back to this week</button>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Reminder settings"><Settings2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => go(addDaysISO(start, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Progress */}
      <Card className="p-4 flex items-center gap-4">
        <ProgressRing pct={stats.pct} />
        <div className="flex-1 min-w-0">
          <p className="font-medium">{stats.total ? `${stats.done} of ${stats.total} done` : "Nothing planned yet"}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOT.training)} />{stats.training} training</span>
            <span className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOT.recovery)} />{stats.recovery} recovery</span>
            <span className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOT.class)} />{stats.classes + booked.filter((b) => b.kind === "class").length} classes</span>
            <span className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOT.rest)} />{stats.rest} rest</span>
          </div>
        </div>
        {streak > 0 && (
          <div className="text-center shrink-0">
            <Flame className="h-5 w-5 mx-auto text-gold-contrast" />
            <p className="text-xs font-medium">{streak} wk{streak > 1 ? "s" : ""}</p>
          </div>
        )}
      </Card>

      {upcoming && (
        <div className="rounded-md border border-gold bg-gold/10 p-3 flex items-center gap-3">
          <BellRing className="h-5 w-5 text-gold-contrast shrink-0" />
          <p className="text-sm flex-1">Coming up at {fmtTime(upcoming.e.start_time)}: <span className="font-medium">{titleOf(upcoming.e)}</span></p>
        </div>
      )}

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const items = [...entries.filter((e) => e.plan_date === d).map((e) => ({ c: e.category, done: e.status === "done" })),
            ...booked.filter((b) => b.date === d).map((b) => ({ c: b.kind === "class" ? "class" : "spa", done: false }))];
          return (
            <button key={d} onClick={() => setDay(d)}
              className={cn("rounded-md border py-2 flex flex-col items-center gap-1 transition-colors",
                d === day ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card",
                d === today && d !== day && "border-accent")}>
              <span className="text-[10px] uppercase tracking-wide opacity-80">{dayLabel(d, "EEE")}</span>
              <span className="text-base font-medium leading-none">{dayLabel(d, "d")}</span>
              <span className="flex gap-0.5 h-1.5">
                {items.slice(0, 4).map((x, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", DOT[x.c] || "bg-muted", x.done && "ring-1 ring-ring")} />)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Suggestions */}
      {tips.map((t) => (
        <Card key={t.id} className="p-3 space-y-2">
          <p className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-gold-contrast" />{t.text} <span className="text-muted-foreground">({dayLabel(t.day, "EEE")})</span></p>
          <div className="flex flex-wrap gap-2">
            {t.options.map((o) => <Button key={o.key} size="sm" variant="outline" onClick={() => quickAdd(o, t.day)}><Plus className="h-3 w-3 mr-1" />{o.label}</Button>)}
          </div>
        </Card>
      ))}

      {entries.length === 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Wand2 className="h-4 w-4" />Start your week fast</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => copyWeek.mutate({ from: addDaysISO(start, -7), to: start })}><Copy className="h-3 w-3" />Copy last week</Button>
            {STARTER_WEEKS.map((w) => (
              <Button key={w.key} size="sm" variant="outline" onClick={() => addMany.mutate(w.days.map(({ d, a }) => {
                const act = activityByKey(a)!;
                return { plan_date: addDaysISO(start, d), category: act.category, activity_key: act.key, label: act.label, duration_min: act.minutes ?? null };
              }))}>{w.label}</Button>
            ))}
          </div>
        </Card>
      )}

      {/* Day view */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">{dayLabel(day, "EEEE, MMM d")}{day === today && <span className="text-accent text-xs ml-2">Today</span>}</p>
          <Button size="sm" className="gap-1" onClick={() => newDraft({})}><Plus className="h-4 w-4" />Add</Button>
        </div>

        {dayBooked.map((b) => {
          const Icon = ICON[b.kind === "class" ? "class" : "spa"];
          return (
            <Card key={b.id} className="p-3 flex items-center gap-3">
              <span className={cn("h-9 w-9 rounded-full flex items-center justify-center text-primary-foreground shrink-0", DOT[b.kind === "class" ? "class" : "spa"])}><Icon className="h-4 w-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.title}</p>
                <p className="text-xs text-muted-foreground">{fmtTime(b.time)}</p>
              </div>
              <Badge variant="secondary">Booked</Badge>
              <Link to={b.href} className="text-xs underline text-accent">View</Link>
            </Card>
          );
        })}

        {dayEntries.length === 0 && dayBooked.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing planned. Tap Add to plan training, recovery or a class.</p>
        )}

        {dayEntries.map((e) => {
          const t = e.template_id ? byId.get(e.template_id) : undefined;
          const Icon = ICON[e.category] || Dumbbell;
          const isDone = e.status === "done"; const isSkip = e.status === "skipped";
          return (
            <Card key={e.id} className={cn("p-3 space-y-2", (isDone || isSkip) && "opacity-75")}>
              <div className="flex items-center gap-3">
                <button aria-label={isDone ? "Mark not done" : "Mark done"}
                  onClick={() => update.mutate({ id: e.id, status: isDone ? "planned" : "done", completed_at: isDone ? null : new Date().toISOString() })}
                  className={cn("h-10 w-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isDone ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                  {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0" onClick={() => setDraft({
                  id: e.id, plan_date: e.plan_date, category: e.category, activity_key: e.activity_key, template_id: e.template_id,
                  label: e.label, start_time: e.start_time?.slice(0, 5) || "", reminder_offset_min: e.reminder_offset_min || 0, duration_min: e.duration_min,
                })}>
                  <p className={cn("font-medium truncate", isSkip && "line-through")}>{titleOf(e)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {e.start_time ? fmtTime(e.start_time) : "Any time"}{e.duration_min ? ` · ${e.duration_min} min` : ""}
                    {e.reminder_offset_min ? <Bell className="h-3 w-3 ml-1" /> : null}
                  </p>
                </div>
                {isSkip && <Badge variant="secondary">Skipped</Badge>}
                {t && !isDone && <Button size="sm" className="gap-1" onClick={() => onStart(e, t)}><Play className="h-4 w-4" />Start</Button>}
              </div>
              {t && <p className="text-xs text-muted-foreground line-clamp-1 pl-[52px]">{t.exercises.map((x) => x.name).join(" · ")}</p>}
              {!isDone && (
                <div className="flex gap-1 pl-[52px]">
                  {!isSkip && <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => update.mutate({ id: e.id, status: "skipped" })}><X className="h-3 w-3" />Skip</Button>}
                  {isSkip && <Button size="sm" variant="ghost" className="h-8" onClick={() => update.mutate({ id: e.id, status: "planned" })}>Undo skip</Button>}
                  <Select value="" onValueChange={(d) => update.mutate({
                    id: e.id, plan_date: d, reminder_at: reminderAt(d, e.start_time, e.reminder_offset_min)?.toISOString() ?? null,
                  } as any)}>
                    <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent text-sm px-2"><ArrowRightLeft className="h-3 w-3" /><span>Move</span></SelectTrigger>
                    <SelectContent>{days.filter((d) => d !== e.plan_date).map((d) => <SelectItem key={d} value={d}>{dayLabel(d, "EEE, MMM d")}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => remove.mutate(e.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Daily habits + check-in */}
      <Card className="p-4 space-y-3">
        <p className="font-medium text-sm">Daily habits</p>
        <div className="grid grid-cols-2 gap-2">
          {HABITS.map((h) => {
            const on = !!checkin?.habits?.[h.key];
            return (
              <button key={h.key} onClick={() => saveCheckin.mutate({ date: day, habits: { ...(checkin?.habits || {}), [h.key]: !on } })}
                className={cn("rounded-md border px-3 py-2 text-sm flex items-center gap-2", on ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                <Check className={cn("h-4 w-4", !on && "opacity-30")} />{h.label}
              </button>
            );
          })}
        </div>
        {(["energy", "mood"] as const).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-sm w-14 capitalize">{k}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => saveCheckin.mutate({ date: day, [k]: n })} aria-label={`${k} ${n}`}
                  className={cn("h-8 w-8 rounded-full border text-sm", checkin?.[k] === n ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        <Textarea key={day} defaultValue={checkin?.note || ""} placeholder="How did today feel?" rows={2}
          onBlur={(ev) => ev.target.value !== (checkin?.note || "") && saveCheckin.mutate({ date: day, note: ev.target.value || null })} />
      </Card>

      {start < weekStartISO(today) || (start === weekStartISO(today) && today === addDaysISO(start, 6)) ? (
        <Card className="p-4 text-sm">
          <p className="font-medium mb-1">Week summary</p>
          <p className="text-muted-foreground">{stats.done} completed · {stats.recovery} recovery sessions planned · {stats.total - stats.done} not done. {stats.pct >= 70 ? "You hit your plan." : "Next week, try planning a little less and keeping it."}</p>
        </Card>
      ) : null}

      <AddEditSheet draft={draft} setDraft={setDraft} onSave={saveDraft} templates={templates} days={days} fromActivity={fromActivity} />
      <ReminderSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} strokeWidth="5" className="fill-none stroke-secondary" />
        <circle cx="28" cy="28" r={r} strokeWidth="5" strokeLinecap="round" className="fill-none stroke-primary transition-all"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">{pct}%</span>
    </div>
  );
}

function AddEditSheet({ draft, setDraft, onSave, templates, days, fromActivity }: {
  draft: Draft | null; setDraft: (d: Draft | null) => void; onSave: () => void;
  templates: WorkoutTemplate[]; days: string[]; fromActivity: (a: Activity, d?: string) => void;
}) {
  const choosing = draft && !draft.id && !draft.activity_key && !draft.template_id && !draft.label;
  const set = (p: Partial<Draft>) => draft && setDraft({ ...draft, ...p });
  return (
    <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-xl">
        <SheetHeader><SheetTitle>{draft?.id ? "Edit plan item" : choosing ? "What are you planning?" : "Plan details"}</SheetTitle></SheetHeader>
        {draft && choosing && (
          <div className="space-y-4 mt-4">
            {templates.length > 0 && (
              <Section title="My workouts">
                {templates.map((t) => (
                  <Tile key={t.id} icon={Dumbbell} label={t.template_name} onClick={() => set({ category: "training", template_id: t.id, label: t.template_name })} />
                ))}
              </Section>
            )}
            <Section title="Recovery">
              {RECOVERY.map((a) => <Tile key={a.key} icon={Sparkles} label={a.label} onClick={() => fromActivity(a, draft.plan_date)} />)}
            </Section>
            <Section title="Other">
              <Tile icon={CalendarCheck} label="Class at the club" onClick={() => set({ category: "class", activity_key: "club_class", label: "Class at the club" })} />
              {OTHER.map((a) => <Tile key={a.key} icon={ICON[a.category]} label={a.label} onClick={() => fromActivity(a, draft.plan_date)} />)}
            </Section>
          </div>
        )}
        {draft && !choosing && (
          <div className="space-y-4 mt-4">
            {(!draft.template_id && !activityByKey(draft.activity_key)) || draft.activity_key === "custom_training" ? (
              <Field label="Name"><Input value={draft.label || ""} onChange={(e) => set({ label: e.target.value })} /></Field>
            ) : <p className="font-medium">{draft.label}</p>}
            {draft.category === "class" && (
              <p className="text-sm text-muted-foreground">Want a spot held? <Link to="/member/book/class" className="underline text-accent">Book the class</Link>. Booked classes appear here automatically.</p>
            )}
            <Field label="Day">
              <Select value={draft.plan_date} onValueChange={(v) => set({ plan_date: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{days.map((d) => <SelectItem key={d} value={d}>{dayLabel(d, "EEEE, MMM d")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {draft.category !== "rest" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time (optional)"><Input type="time" value={draft.start_time} onChange={(e) => set({ start_time: e.target.value })} /></Field>
                <Field label="Minutes"><Input type="number" inputMode="numeric" value={draft.duration_min ?? ""} onChange={(e) => set({ duration_min: e.target.value ? Number(e.target.value) : null })} /></Field>
              </div>
            )}
            {draft.category !== "rest" && (
              <Field label="Reminder">
                <Select value={String(draft.reminder_offset_min)} onValueChange={(v) => set({ reminder_offset_min: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.filter((o) => o.v <= 0 || draft.start_time).map((o) => <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Sent by text if you've agreed to club texts. Shown in the app either way.</p>
              </Field>
            )}
            <Button className="w-full" onClick={onSave}>{draft.id ? "Save changes" : "Add to plan"}</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReminderSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { prefs, save } = useReminderPrefs();
  const [on, setOn] = useState<boolean | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const enabled = on ?? prefs?.daily_summary ?? false;
  const t = time ?? prefs?.summary_time?.slice(0, 5) ?? "07:30";
  const submit = () => {
    const today = detroitTodayISO();
    let next = detroitWallToUtc(today, t);
    if (next.getTime() <= Date.now()) next = detroitWallToUtc(addDaysISO(today, 1), t);
    save.mutate({ daily_summary: enabled, summary_time: t, next_summary_at: enabled ? next.toISOString() : null });
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader><SheetTitle>Reminders</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Morning plan text</p>
              <p className="text-xs text-muted-foreground">A short text with today's plan. Only sent if you've agreed to club texts.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setOn} />
          </div>
          {enabled && <Field label="Send at"><Input type="time" value={t} onChange={(e) => setTime(e.target.value)} /></Field>}
          <p className="text-xs text-muted-foreground">We send at most 3 plan reminders a day. Club bookings keep their usual reminders.</p>
          <Button className="w-full" onClick={submit}>Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</p><div className="grid grid-cols-3 gap-2">{children}</div></div>
);
const Tile = ({ icon: Icon, label, onClick }: { icon: typeof Dumbbell; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="rounded-md border border-border bg-card p-3 flex flex-col items-center gap-1.5 text-center hover:border-primary">
    <Icon className="h-5 w-5" /><span className="text-xs leading-tight line-clamp-2">{label}</span>
  </button>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-sm">{label}</span>{children}</label>
);
