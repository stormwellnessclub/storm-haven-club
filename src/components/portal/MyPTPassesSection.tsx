import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyPTPortal, upcomingPT, type MyPTPortalData } from "@/hooks/useMyPTPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, X } from "lucide-react";
import { format as fmtDate, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { PT_FORMAT_LABEL, memberCancelOutcomeMessage } from "@/lib/ptFormat";
import { toast } from "sonner";

type Appt = MyPTPortalData["appointments"][number];

export function MyPTPassesSection() {
  const qc = useQueryClient();

  const { data: portal } = useMyPTPortal();
  const passes = (portal?.passes ?? []).filter((p) => ["active", "exhausted", "expired"].includes(p.status));
  const appts = upcomingPT(portal);

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
    qc.invalidateQueries({ queryKey: ["pt-my-portal"] });
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
                        {a.trainer || "Any trainer"}
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
              const exp = parseISO(p.expires_at ?? new Date().toISOString());
              const days = differenceInDays(exp, new Date());
              const expSoon = p.status === "active" && days <= 14;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="font-medium">{PT_FORMAT_LABEL[p.format as keyof typeof PT_FORMAT_LABEL] ?? p.format}</div>
                        <div className="text-xs text-muted-foreground">{p.pack_name}</div>
                      </div>
                      <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="text-2xl font-semibold mt-2">
                      {p.sessions_remaining}<span className="text-base text-muted-foreground">/{p.sessions_total} sessions</span>
                    </div>
                    {((p as { sessions_on_hold?: number }).sessions_on_hold ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        +{(p as { sessions_on_hold?: number }).sessions_on_hold} added with future payments
                      </div>
                    )}
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
