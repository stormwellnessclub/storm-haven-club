import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSpaServiceRequests } from "@/hooks/useSpaServiceRequests";

export function SpaRequestAlert({ to }: { to: string }) {
  const { data, error } = useSpaServiceRequests();
  const count = (data ?? []).filter((request) => request.status === "new").length;

  if (!error && count === 0) return null;

  return (
    <Card role="status" className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <CalendarClock className="h-6 w-6 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Spa Appointment Requests</p>
            <p className="text-sm text-muted-foreground">
              {error ? "Could not load appointment requests." : `${count} new request${count === 1 ? "" : "s"} awaiting attention`}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="shrink-0 border-destructive/50">
          <Link to={to}>View Requests <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}