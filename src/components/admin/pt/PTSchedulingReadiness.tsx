import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Row = {
  instructor_id: string; name: string; recurring_configured: boolean; upcoming_availability: boolean;
  time_off_conflicts: number; client_booking_mode: string; ready: boolean;
};
const MODE: Record<string, string> = { off: "Off", request: "Request Only", instant: "Instant Booking" };

/** Read-only readiness for future client booking. Never turns booking on. */
export function PTSchedulingReadiness() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pt-trainer-readiness"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_trainer_readiness");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  return (
    <section className="border rounded-lg bg-card">
      <div className="px-4 py-3 border-b">
        <h2 className="font-serif text-xl">Scheduling readiness</h2>
        <p className="text-xs text-muted-foreground">Whether each trainer's hours are set up well enough for client booking later. Client booking stays off until you turn it on.</p>
      </div>
      {isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading…</div> :
        data.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No PT trainers yet.</div> :
        <div className="divide-y">
          {data.map((r) => (
            <div key={r.instructor_id} className="px-4 py-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm items-center">
              <div className="font-medium md:col-span-1">{r.name}</div>
              <div><span className="text-muted-foreground text-xs block">Weekly hours</span>{r.recurring_configured ? "Configured" : "Missing"}</div>
              <div><span className="text-muted-foreground text-xs block">Next 2 weeks</span>{r.upcoming_availability ? "Has hours" : "None"}</div>
              <div><span className="text-muted-foreground text-xs block">Time-off conflicts</span>{r.time_off_conflicts === 0 ? "None" : `${r.time_off_conflicts} session(s)`}</div>
              <div><span className="text-muted-foreground text-xs block">Client booking</span>{MODE[r.client_booking_mode] ?? r.client_booking_mode}</div>
              <div><Badge variant={r.ready ? "secondary" : "outline"}>{r.ready ? "Ready" : "Not ready"}</Badge></div>
            </div>
          ))}
        </div>}
    </section>
  );
}
