import { Link, useLocation } from "react-router-dom";
import { useCancelMyPTSession } from "@/hooks/useCancelMyPTSession";
import { useMyPTPortal, upcomingPT } from "@/hooks/useMyPTPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, X } from "lucide-react";
import { format as fmtDate, parseISO } from "date-fns";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";

/** Shared "Upcoming PT Sessions" card for member & non-member portal dashboards. */
export function UpcomingPTAppointmentsCard({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();

  const { data: portal } = useMyPTPortal();
  const appts = upcomingPT(portal).slice(0, 5);

  const cancel = useCancelMyPTSession();

  if (appts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Dumbbell className="h-4 w-4" /> Upcoming Personal Training
        </CardTitle>
        <Link to={pathname.startsWith("/member") ? "/member/personal-training" : "/portal/personal-training"} className="text-xs text-primary hover:underline">View all</Link>
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
                {a.trainer ? ` · ${a.trainer}` : " · Any trainer"}
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
