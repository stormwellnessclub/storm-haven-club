import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, CircleDot, Sparkles, Baby, X, RefreshCw } from "lucide-react";
import { format, parseISO, differenceInHours, addDays } from "date-fns";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/timeFormat";
import { CANCELLATION_POLICY_TEXT } from "@/components/booking/CancellationPolicyText";
import { useUpcomingBookings, useCancelBooking } from "@/hooks/useBooking";
import { useMySpaAppointments, useCancelSpaAppointment } from "@/hooks/useSpaBooking";
import { useMyKidsCareBookings, useCancelKidsCareBooking } from "@/hooks/useKidsCareBooking";

type Kind = "class" | "spa" | "kids";

interface Row {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm[:ss]
  endTime?: string;
  raw: any;
}

const ICON_BY_KIND: Record<Kind, { icon: any; tone: string; label: string }> = {
  class: { icon: CircleDot, tone: "bg-gold/10 text-gold", label: "Class" },
  spa: { icon: Sparkles, tone: "bg-accent/10 text-accent", label: "Spa" },
  kids: { icon: Baby, tone: "bg-rose-500/10 text-rose-500", label: "Kids care" },
};

interface UpcomingBookingsPanelProps {
  scope?: "member" | "portal";
}

export function UpcomingBookingsPanel({ scope = "member" }: UpcomingBookingsPanelProps) {
  const navigate = useNavigate();

  const { data: classBookings, isLoading: classLoading } = useUpcomingBookings();
  const { data: spaAppointments, isLoading: spaLoading } = useMySpaAppointments();
  const { data: kidsBookings, isLoading: kidsLoading } = useMyKidsCareBookings();

  const cancelClass = useCancelBooking();
  const cancelSpa = useCancelSpaAppointment();
  const cancelKids = useCancelKidsCareBooking();

  const [pending, setPending] = useState<Row | null>(null);
  const [mode, setMode] = useState<"cancel" | "reschedule">("cancel");

  const rows: Row[] = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const horizon = format(addDays(new Date(), 14), "yyyy-MM-dd");
    const merged: Row[] = [];

    for (const b of classBookings || []) {
      const s = (b as any).session;
      if (!s?.session_date || !s?.start_time) continue;
      if (s.session_date > horizon) continue;
      merged.push({
        id: b.id,
        kind: "class",
        title: s.class_type?.name || "Class",
        subtitle: s.instructor
          ? `${s.instructor.first_name} ${s.instructor.last_name}${s.room ? ` · ${s.room}` : ""}`
          : s.room || undefined,
        date: s.session_date,
        time: s.start_time,
        endTime: s.end_time,
        raw: b,
      });
    }

    for (const a of spaAppointments || []) {
      if (a.status !== "confirmed") continue;
      if (!a.appointment_date) continue;
      if (a.appointment_date < today || a.appointment_date > horizon) continue;
      merged.push({
        id: a.id,
        kind: "spa",
        title: a.service_name || "Spa service",
        subtitle: a.service_category || undefined,
        date: a.appointment_date,
        time: a.appointment_time,
        raw: a,
      });
    }

    if (scope === "member") {
      for (const k of kidsBookings || []) {
        if (k.status === "cancelled" || k.status === "no_show") continue;
        if (!k.booking_date) continue;
        if (k.booking_date < today || k.booking_date > horizon) continue;
        merged.push({
          id: k.id,
          kind: "kids",
          title: k.child_name,
          subtitle: k.age_group || undefined,
          date: k.booking_date,
          time: k.start_time,
          endTime: k.end_time,
          raw: k,
        });
      }
    }

    merged.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return merged;
  }, [classBookings, spaAppointments, kidsBookings, scope]);

  const isLoading =
    classLoading || spaLoading || (scope === "member" ? kidsLoading : false);

  if (!isLoading && rows.length === 0) return null;

  const startCancel = (row: Row) => {
    setMode("cancel");
    setPending(row);
  };
  const startReschedule = (row: Row) => {
    setMode("reschedule");
    setPending(row);
  };

  const isLateCancel = (row: Row) => {
    try {
      const dt = new Date(`${row.date}T${row.time}`);
      return differenceInHours(dt, new Date()) < 24;
    } catch {
      return false;
    }
  };

  const doCancel = async (row: Row): Promise<boolean> => {
    try {
      if (row.kind === "class") {
        await cancelClass.mutateAsync(row.id);
      } else if (row.kind === "spa") {
        await cancelSpa.mutateAsync({ appointmentId: row.id });
      } else {
        await cancelKids.mutateAsync({ bookingId: row.id });
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const row = pending;
    const ok = await doCancel(row);
    setPending(null);
    if (!ok) return;

    if (mode === "reschedule") {
      toast.success("Original booking cancelled — pick a new time");
      const base = scope === "portal" ? "/portal" : "/member";
      if (row.kind === "class") navigate(`${base}/book/class?rescheduleFrom=${row.id}`);
      else if (row.kind === "spa") navigate(`/spa?rescheduleFrom=${row.id}`);
      else navigate(`/member/kids-care?rescheduleFrom=${row.id}`);
    }
  };

  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-base">Upcoming bookings</h2>
        <span className="text-[11px] text-muted-foreground">Next 14 days</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const meta = ICON_BY_KIND[row.kind];
            const Icon = meta.icon;
            return (
              <li
                key={`${row.kind}-${row.id}`}
                className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{row.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(row.date), "EEE, MMM d")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime12h(row.time)}
                    </span>
                    {row.subtitle && <span className="truncate">{row.subtitle}</span>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => startReschedule(row)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-destructive hover:text-destructive"
                    onClick={() => startCancel(row)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "reschedule" ? "Reschedule booking" : "Cancel booking"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {pending && (
                  <div className="text-sm text-foreground">
                    {pending.title} ·{" "}
                    {format(parseISO(pending.date), "EEE, MMM d")} at{" "}
                    {formatTime12h(pending.time)}
                  </div>
                )}
                {mode === "reschedule" ? (
                  <div>
                    We'll cancel this booking and take you to pick a new time.
                    Your credit or pass will be refunded
                    {pending && isLateCancel(pending) ? " only if outside the 24-hour window" : ""}.
                  </div>
                ) : pending && isLateCancel(pending) ? (
                  <div>
                    This starts in less than 24 hours. Your credit or pass{" "}
                    <strong>will not be refunded</strong>.
                  </div>
                ) : (
                  <div>Your credit or pass will be refunded immediately.</div>
                )}
                <div className="text-xs bg-muted/50 rounded-md p-2">
                  <span className="font-medium text-foreground">Cancellation policy:</span>{" "}
                  {CANCELLATION_POLICY_TEXT}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mode === "reschedule" ? "Cancel & rebook" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default UpcomingBookingsPanel;
