import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, X } from "lucide-react";
import { format as fmtDate, parseISO, differenceInHours } from "date-fns";
import { PT_FORMAT_LABEL, memberCancelOutcomeMessage } from "@/lib/ptFormat";
import { toast } from "sonner";

interface Appt {
  id: string; format: string; starts_at: string; duration_minutes: number;
  instructor_id: string | null; status: string;
}

/** Shared "Upcoming PT Sessions" card for member & non-member portal dashboards. */
export function UpcomingPTAppointmentsCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: appts = [] } = useQuery({
    queryKey: ["upcoming-pt-appointments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("id, format, starts_at, duration_minutes, instructor_id, status")
        .eq("user_id", user!.id)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Appt[];
    },
  });

  const instructorIds = Array.from(new Set(appts.map((a) => a.instructor_id).filter(Boolean) as string[]));
  const { data: instructors = {} } = useQuery({
    queryKey: ["upcoming-pt-instructors", instructorIds],
    enabled: instructorIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await (supabase.rpc as any)("get_public_instructors");
      const m: Record<string, string> = {};
      (data ?? [])
        .filter((i: any) => instructorIds.includes(i.id))
        .forEach((i: any) => { m[i.id] = `${i.first_name} ${i.last_name}`; });
      return m;
    },
  });

  if (appts.length === 0) return null;

  async function cancel(a: Appt) {
    const hoursOut = differenceInHours(parseISO(a.starts_at), new Date());
    const warn = hoursOut < 24
      ? "This is less than 24 hours away. Cancelling now will forfeit this session from your pack. Continue?"
      : "Cancel this session? If it was booked from a pack, it will be returned.";
    if (!window.confirm(warn)) return;
    const { data, error } = await (supabase as any).rpc("cancel_pt_appointment", {
      p_appointment_id: a.id, p_reason: "Cancelled by member",
    });
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(memberCancelOutcomeMessage(row?.cancel_credit_outcome));
    supabase.functions.invoke("send-pt-booking-email", { body: { appointment_id: a.id, type: "cancellation" } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["upcoming-pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["my-pt-passes"] });
  }


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Dumbbell className="h-4 w-4" /> Upcoming Personal Training
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {appts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {PT_FORMAT_LABEL[a.format as keyof typeof PT_FORMAT_LABEL] ?? a.format}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(parseISO(a.starts_at), "EEE, MMM d · h:mm a")} · {a.duration_minutes} min
                {a.instructor_id && instructors[a.instructor_id] ? ` · ${instructors[a.instructor_id]}` : " · Any trainer"}
              </p>
            </div>
            {!compact && (
              <Button size="sm" variant="ghost" onClick={() => cancel(a)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            )}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground pt-1">
          Free cancellation up to 24 hours before your session. Late cancellations forfeit the session.
        </p>
      </CardContent>
    </Card>
  );
}
