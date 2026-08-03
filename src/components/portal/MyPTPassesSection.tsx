import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, X } from "lucide-react";
import { format as fmtDate, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { PT_FORMAT_LABEL, PtPass, memberCancelOutcomeMessage } from "@/lib/ptFormat";
import { toast } from "sonner";

interface Appt {
  id: string; format: string; starts_at: string; duration_minutes: number;
  instructor_id: string | null; status: string;
}

export function MyPTPassesSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: passes = [] } = useQuery({
    queryKey: ["my-pt-passes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select("*")
        .eq("user_id", user!.id)
        .in("status", ["active", "exhausted", "expired"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PtPass[];
    },
  });

  const { data: appts = [] } = useQuery({
    queryKey: ["my-pt-appointments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("id, format, starts_at, duration_minutes, instructor_id, status")
        .eq("user_id", user!.id)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appt[];
    },
  });

  const instructorIds = Array.from(new Set(appts.map((a) => a.instructor_id).filter(Boolean) as string[]));
  const { data: instructors = {} } = useQuery({
    queryKey: ["my-pt-instructors", instructorIds],
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

  async function cancel(a: Appt) {
    const hoursOut = differenceInHours(parseISO(a.starts_at), new Date());
    const warn = hoursOut < 24
      ? "This is less than 24 hours away. Cancelling now will forfeit this session from your pack. Continue?"
      : "Cancel this session? It will be returned to your pack.";
    if (!window.confirm(warn)) return;
    const { error } = await (supabase as any).rpc("cancel_pt_appointment", {
      p_appointment_id: a.id, p_reason: "Cancelled by member",
    });
    if (error) return toast.error(error.message);
    toast.success(hoursOut < 24 ? "Cancelled (session forfeited)" : "Cancelled · session returned");
    supabase.functions.invoke("send-pt-booking-email", { body: { appointment_id: a.id, type: "cancellation" } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["my-pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["my-pt-passes"] });
  }

  if (passes.length === 0 && appts.length === 0) return null;

  return (
    <div className="mb-6 space-y-6">
      {appts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Upcoming PT Sessions
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {appts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{PT_FORMAT_LABEL[a.format as keyof typeof PT_FORMAT_LABEL] ?? a.format}</div>
                      <div className="text-sm text-muted-foreground">
                        {fmtDate(parseISO(a.starts_at), "EEE, MMM d · h:mm a")} · {a.duration_minutes} min
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.instructor_id ? (instructors[a.instructor_id] ?? "Trainer") : "Any trainer"}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => cancel(a)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Free cancellation up to 24 hours before your session. Late cancellations forfeit the session from your pack.
          </p>
        </div>
      )}

      {passes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Dumbbell className="h-5 w-5" /> My Personal Training
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {passes.map((p) => {
              const exp = parseISO(p.expires_at);
              const days = differenceInDays(exp, new Date());
              const expSoon = p.status === "active" && days <= 14;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="font-medium">{PT_FORMAT_LABEL[p.format]}</div>
                        <div className="text-xs text-muted-foreground">{p.pack_name}</div>
                      </div>
                      <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="text-2xl font-semibold mt-2">
                      {p.sessions_remaining}<span className="text-base text-muted-foreground">/{p.sessions_total} sessions</span>
                    </div>
                    <div className={`text-xs mt-1 ${expSoon ? "text-destructive" : "text-muted-foreground"}`}>
                      Expires {fmtDate(exp, "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
