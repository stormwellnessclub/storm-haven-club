import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useAllAppointmentHistory } from "@/hooks/useAllAppointmentHistory";
import { SpaAppointmentRow } from "./SpaAppointmentRow";

/** Shared upcoming spa appointments card for portal dashboards. */
export function UpcomingSpaAppointmentsCard({ canCancel = true }: { canCancel?: boolean }) {
  const { upcomingSpa } = useAllAppointmentHistory();
  if (upcomingSpa.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Upcoming Spa & Recovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcomingSpa.slice(0, 5).map((a) => (
          <SpaAppointmentRow key={a.id} appt={a} showCancel={canCancel} showIntake />
        ))}
        <p className="text-[11px] text-muted-foreground pt-1">
          Free cancellation up to 24 hours before your appointment.
        </p>
      </CardContent>
    </Card>
  );
}
