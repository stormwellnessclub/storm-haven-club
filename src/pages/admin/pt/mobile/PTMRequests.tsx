import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMCard, PTMSectionTitle, PTMEmpty } from "@/components/admin/pt/mobile/PTMobileUI";
import { PTSlotCard, usePTWaitlistEntries } from "@/components/admin/pt/PTSlotCard";
import { usePTRequestHolds, usePTScheduleAppointments } from "@/hooks/pt/usePTSchedule";
import { usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import { PTRequestPanel } from "@/pages/admin/pt/PTRequests";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildWaitlistSlots } from "@/lib/ptSlots";

/** Phone view for trainers and staff: requests to answer, then waitlisted hours (opened ones first). */
export default function PTMRequests() {
  const qc = useQueryClient();
  const [requestId, setRequestId] = useState<string | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fromIso = today.toISOString();
  const toIso = addDays(today, 60).toISOString();
  const { data: holds = [], isLoading } = usePTRequestHolds(fromIso, toIso);
  const { data: waiters = [] } = usePTWaitlistEntries(format(today, "yyyy-MM-dd"), format(addDays(today, 60), "yyyy-MM-dd"));
  const { data: appts = [] } = usePTScheduleAppointments({ fromIso, toIso, trainerId: "all", locationId: "all", sessionTypeId: "all", status: "all" });
  const trainerMap = usePTTrainerMap();
  const slots = useMemo(() => buildWaitlistSlots(holds, appts as any, waiters)
    .sort((a, z) => Number(z.state === "opened") - Number(a.state === "opened")), [holds, appts, waiters]);

  const refresh = () => ["pt-requests", "pt-waitlist", "pt-appointments"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  return (
    <PTMobileShell title="Requests" right={
      <button aria-label="Refresh" onClick={refresh} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"><RefreshCw className="h-5 w-5" /></button>
    }>
      <PTMSectionTitle>Requests to answer ({holds.length})</PTMSectionTitle>
      {!isLoading && holds.length === 0 && <PTMEmpty title="No requests waiting" />}
      <div className="space-y-2 mb-6">
        {holds.map((h) => (
          <button key={h.id} onClick={() => setRequestId(h.id)} className="block w-full text-left">
            <PTMCard className="p-3">
              <p className="font-semibold text-[14px]">{h.client_name ?? "Client"}</p>
              <p className="text-[12px] text-pt-muted">{format(new Date(h.starts_at), "EEE MMM d · h:mm a")} · {h.trainer_id ? trainerMap[h.trainer_id] ?? "" : "Any trainer"}</p>
              <p className="text-[12px] text-pt-muted">{h.session_name ?? "Session"} · {h.request_status === "alternate_offered" ? "Time offered" : "Requested"}</p>
            </PTMCard>
          </button>
        ))}
      </div>

      <PTMSectionTitle>Waitlist ({slots.length} hours)</PTMSectionTitle>
      {slots.length === 0 && <PTMEmpty title="No one is waiting" />}
      <div className="space-y-3">
        {slots.map((s) => (
          <PTMCard key={s.key} className="p-3">
            <PTSlotCard compact slot={s} trainerName={trainerMap[s.trainer_id]} onOpenRequest={setRequestId} />
          </PTMCard>
        ))}
      </div>

      <Sheet open={!!requestId} onOpenChange={(o) => !o && setRequestId(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader><SheetTitle>Client request</SheetTitle></SheetHeader>
          <div className="mt-4">{requestId && <PTRequestPanel requestId={requestId} />}</div>
        </SheetContent>
      </Sheet>
    </PTMobileShell>
  );
}
