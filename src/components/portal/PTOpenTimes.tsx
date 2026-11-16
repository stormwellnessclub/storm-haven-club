import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { groupTrainerSlotsByDay, type PTTrainerSlot } from "@/lib/ptRequestForm";

export const ptErrText = (e: any) => String(e?.message ?? e ?? "Something went wrong").replace(/^[A-Z_]+:\s*/, "");

/**
 * Every eligible trainer's open one-hour blocks for a session, grouped by day (server-derived times only).
 * Used by Request Session and by "Change time" on a pending request.
 */
export function PTOpenTimes({ sessionTypeId, durationMinutes = 60, selectedKey, onPick }: {
  sessionTypeId: string; durationMinutes?: number; selectedKey: string | null;
  onPick: (slot: { iso: string; trainerId: string }) => void;
}) {
  const times = useQuery({
    queryKey: ["pt-client-request-times", sessionTypeId],
    enabled: !!sessionTypeId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_client_request_times_all", { p_session_type_id: sessionTypeId, p_days: 14 });
      if (error) throw error;
      return (data ?? []) as PTTrainerSlot[];
    },
  });
  const days = useMemo(() => groupTrainerSlotsByDay(times.data ?? [], durationMinutes), [times.data, durationMinutes]);

  return (
    <div className="space-y-2">
      <Label>Available times</Label>
      {times.isLoading ? <p className="text-sm text-muted-foreground">Finding open times…</p>
        : times.error ? <p className="text-sm text-destructive">{ptErrText(times.error)}</p>
        : days.length === 0 ? <p className="text-sm text-muted-foreground">No open times in the next two weeks. Please contact the club.</p>
        : <div className="space-y-3" data-testid="pt-request-times">{days.map((d) => (
            <div key={d.label} className="space-y-1.5">
              <p className="text-sm font-medium">{d.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{d.slots.map((s) => (
                <Button key={s.key} type="button" size="sm" variant={selectedKey === s.key ? "default" : "outline"}
                  className="h-auto justify-between gap-2 py-2 normal-case tracking-normal" aria-pressed={selectedKey === s.key}
                  onClick={() => onPick({ iso: s.iso, trainerId: s.trainerId })}>
                  <span>{s.time}</span><span className="text-xs opacity-80">{s.trainer}</span></Button>
              ))}</div>
            </div>))}</div>}
    </div>
  );
}
