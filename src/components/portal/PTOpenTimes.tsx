import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { groupTrainerSlotsByDay, ptTrainerShade, type PTTrainerShade, type PTTrainerSlot } from "@/lib/ptRequestForm";

export const ptErrText = (e: any) => String(e?.message ?? e ?? "Something went wrong").replace(/^[A-Z_]+:\s*/, "");

/**
 * Every eligible trainer's open one-hour blocks for a session, grouped by day (server-derived times only).
 * Used by Request Session and by "Change time" on a pending request.
 */
const SHADE_CLASS: Record<Exclude<PTTrainerShade, null>, string> = {
  deep: "bg-trainer-deep text-trainer-deep-foreground border-trainer-deep hover:bg-trainer-deep hover:text-trainer-deep-foreground",
  tan: "bg-trainer-tan text-trainer-tan-foreground border-trainer-tan hover:bg-trainer-tan hover:text-trainer-tan-foreground",
  sand: "bg-trainer-sand text-trainer-sand-foreground border-trainer-sand hover:bg-trainer-sand hover:text-trainer-sand-foreground",
};
const DOT_CLASS: Record<Exclude<PTTrainerShade, null>, string> = { deep: "bg-trainer-deep", tan: "bg-trainer-tan", sand: "bg-trainer-sand" };

export function PTOpenTimes({ sessionTypeId, durationMinutes = 60, selectedKey = null, selectedKeys, onPick, onWaitlist }: {
  sessionTypeId: string; durationMinutes?: number; selectedKey?: string | null; selectedKeys?: string[];
  /** When set, full hours show as "Waitlist" and tapping one calls this instead of onPick. */
  onWaitlist?: (slot: { iso: string; trainerId: string; day: string; time: string; trainer: string; waitlisted: boolean }) => void;
  onPick: (slot: { iso: string; trainerId: string; day: string; time: string; trainer: string }) => void;
}) {
  // A time only counts as tapped when the finger didn't move to scroll (and the page isn't mid-scroll).
  const down = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const lastScroll = useRef(0);
  useEffect(() => {
    const on = () => { lastScroll.current = Date.now(); };
    window.addEventListener("scroll", on, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", on, { capture: true } as any);
  }, []);
  const tapHandlers = {
    onPointerDown: (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; moved.current = Date.now() - lastScroll.current < 250; },
    onPointerMove: (e: React.PointerEvent) => {
      if (down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 10) moved.current = true;
    },
  };
  const isSelected = (k: string) => (selectedKeys ? selectedKeys.includes(k) : selectedKey === k);
  const times = useQuery({
    queryKey: ["pt-client-request-times", sessionTypeId],
    enabled: !!sessionTypeId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_client_request_times_all", { p_session_type_id: sessionTypeId, p_days: 14 });
      if (error) throw error;
      return (data ?? []) as PTTrainerSlot[];
    },
  });
  const days = useMemo(() => groupTrainerSlotsByDay(times.data ?? [], durationMinutes, !!onWaitlist), [times.data, durationMinutes, onWaitlist]);
  // Week = every day listed (default); Day = one day at a time with a day strip.
  const [view, setView] = useState<"week" | "day">("week");
  const [dayIdx, setDayIdx] = useState(0);
  const safeIdx = Math.min(dayIdx, Math.max(days.length - 1, 0));
  const shownDays = view === "week" ? days : days.slice(safeIdx, safeIdx + 1);
  const trainers = useMemo(() => [...new Set((times.data ?? []).map((t) => t.trainer_name))].sort(), [times.data]);

  return (
    <div className="space-y-2">
      <Label>Available times</Label>
      {times.isLoading ? <p className="text-sm text-muted-foreground">Finding open times…</p>
        : times.error ? <p className="text-sm text-destructive">{ptErrText(times.error)}</p>
        : days.length === 0 ? <p className="text-sm text-muted-foreground">No open times in the next two weeks. Please contact the club.</p>
        : <div className="space-y-3" data-testid="pt-request-times">
          {trainers.length > 1 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Trainer colors">
              {trainers.map((t) => { const sh = ptTrainerShade(t); return (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-3 w-3 rounded-full border border-border", sh ? DOT_CLASS[sh] : "bg-background")} />{t}
                </span>); })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="View">
            {([["week", "Week"], ["day", "Day"]] as const).map(([v, l]) => (
              <Button key={v} type="button" size="sm" role="radio" aria-checked={view === v} variant={view === v ? "default" : "outline"}
                className="normal-case tracking-normal" onClick={() => setView(v)}>{l}</Button>))}
          </div>
          {view === "day" && (
            <div className="flex items-center gap-1" data-testid="pt-day-strip">
              <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label="Previous day" disabled={safeIdx === 0} onClick={() => setDayIdx(safeIdx - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
                {days.map((d, i) => { const [wd, rest] = d.label.split(", "); return (
                  <Button key={d.label} type="button" size="sm" variant={i === safeIdx ? "default" : "outline"} aria-pressed={i === safeIdx}
                    className="h-auto shrink-0 flex-col px-3 py-1.5 normal-case tracking-normal leading-tight" onClick={() => setDayIdx(i)}>
                    <span className="text-[11px]">{wd?.slice(0, 3)}</span><span className="text-xs font-semibold">{rest}</span></Button>); })}
              </div>
              <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label="Next day" disabled={safeIdx >= days.length - 1} onClick={() => setDayIdx(safeIdx + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          {shownDays.map((d) => (
            <div key={d.label} className="space-y-1.5">
              <p className="text-sm font-medium">{d.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{d.slots.map((s) => {
                const on = isSelected(s.key); const sh = ptTrainerShade(s.trainer);
                if (s.status !== "open") {
                  const mine = s.status === "waitlisted";
                  return (
                  <Button key={s.key} type="button" size="sm" variant="outline" data-testid="pt-slot-waitlist"
                    className="h-auto justify-between gap-2 border-dashed py-2 normal-case tracking-normal text-muted-foreground opacity-70"
                    {...tapHandlers}
                    onClick={() => { const skip = moved.current; moved.current = false; down.current = null; if (!skip) onWaitlist?.({ iso: s.iso, trainerId: s.trainerId, day: d.label, time: s.time, trainer: s.trainer, waitlisted: mine }); }}>
                    <span className="inline-flex items-center gap-1.5">
                      {sh && <span className={cn("h-2.5 w-2.5 rounded-full", DOT_CLASS[sh])} aria-hidden />}
                      <span className="line-through decoration-1">{s.time}</span></span>
                    <span className="text-xs font-medium">{mine ? "On waitlist" : "Waitlist"} · {s.trainer}</span></Button>);
                }
                return (
                <Button key={s.key} type="button" size="sm" variant="outline" aria-pressed={on}
                  className={cn("h-auto justify-between gap-2 py-2 normal-case tracking-normal hover:opacity-90",
                    sh ? SHADE_CLASS[sh] : "",
                    on && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
                  {...tapHandlers}
                  onClick={() => { const skip = moved.current; moved.current = false; down.current = null; if (!skip) onPick({ iso: s.iso, trainerId: s.trainerId, day: d.label, time: s.time, trainer: s.trainer }); }}>
                  <span className="inline-flex items-center gap-1.5">{on && <Check className="h-4 w-4" aria-hidden />}{s.time}</span>
                  <span className="text-xs opacity-80">{s.trainer}</span></Button>);
              })}</div>
            </div>))}</div>}
    </div>
  );
}
