import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/timeFormat";
import { type MyIntakeEntry, useMyIntakeForms } from "@/hooks/useBodyWrapIntake";
import { IntakeFormDialog } from "@/components/spa/IntakeFormDialog";

/** "Forms" section on the profile: every spa intake the person has signed. */
export function MyFormsCard() {
  const { data: forms = [], isLoading } = useMyIntakeForms();
  const [open, setOpen] = useState<MyIntakeEntry | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Forms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spa intake forms yet. They appear here after you complete one for a booking.</p>
        ) : (
          forms.map((f) => {
            const upcoming = !!f.appointment_date && f.appointment_date >= today;
            return (
              <div key={`${f.kind}-${f.appointment_id}`} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {f.kind === "body_wrap" ? "Body Wrap Intake & Consent" : "Massage Intake"}
                    <Badge variant="outline" className="text-xs">Signed</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.service_name || "Spa service"}
                    {f.appointment_date && ` · ${format(parseISO(f.appointment_date), "MMM d, yyyy")}`}
                    {f.appointment_time && ` · ${formatTime12h(f.appointment_time)}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(f)}>
                  {upcoming ? "View / Edit" : "View"}
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
      {open && (
        <IntakeFormDialog
          open={!!open}
          onOpenChange={(o) => !o && setOpen(null)}
          appointmentId={open.appointment_id}
          memberId={open.member_id}
          serviceName={open.service_name || undefined}
          kind={open.kind}
        />
      )}
    </Card>
  );
}
