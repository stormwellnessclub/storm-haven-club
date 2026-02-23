import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, differenceInHours } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, AlertTriangle, User } from "lucide-react";
import { formatTime12h } from "@/lib/timeFormat";
import { useCancelBooking } from "@/hooks/useBooking";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PortalBookings() {
  const { user } = useAuth();
  const cancelBooking = useCancelBooking();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["portal-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select(`
          *,
          class_sessions (
            session_date,
            start_time,
            end_time,
            room,
            class_types ( name, category, duration_minutes ),
            instructors ( first_name, last_name )
          )
        `)
        .eq("user_id", user!.id)
        .order("booked_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const now = new Date().toISOString();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.class_sessions?.session_date >= now.slice(0, 10)
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || b.class_sessions?.session_date < now.slice(0, 10)
  );

  const BookingCard = ({ booking, showCancel = false }: { booking: any; showCancel?: boolean }) => {
    const session = booking.class_sessions;
    const classType = session?.class_types;
    const instructor = session?.instructors;
    const sessionDate = session?.session_date ? parseISO(session.session_date) : null;

    // Check if within 24-hour window
    const isLateCancel = (() => {
      if (!session?.session_date || !session?.start_time) return false;
      const classStart = new Date(`${session.session_date}T${session.start_time}`);
      return differenceInHours(classStart, new Date()) < 24;
    })();

    return (
      <Card>
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{classType?.name || "Class"}</p>
              <p className="text-sm text-muted-foreground">
                {sessionDate ? format(sessionDate, "EEEE, MMM d, yyyy") : "—"}{" "}
                · {formatTime12h(session?.start_time)} - {formatTime12h(session?.end_time)}
              </p>
              {session?.room && (
                <p className="text-xs text-muted-foreground">Room: {session.room}</p>
              )}
              {instructor && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {instructor.first_name} {instructor.last_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showCancel && booking.status === "confirmed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={cancelBooking.isPending}
                  >
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isLateCancel ? (
                        <span className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            This class starts in less than 24 hours. Your credit or pass <strong>will not be refunded</strong>.
                          </span>
                        </span>
                      ) : (
                        "Are you sure you want to cancel this booking? Your credit or pass will be refunded."
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelBooking.mutate(booking.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isLateCancel ? "Cancel Anyway" : "Yes, Cancel"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
              {booking.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PortalLayout title="My Bookings">
      <div className="max-w-3xl space-y-4">
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-3 mt-4">
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming bookings.</p>
            ) : (
              upcoming.map((b) => <BookingCard key={b.id} booking={b} showCancel />)
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-3 mt-4">
            {past.length === 0 ? (
              <p className="text-muted-foreground text-sm">No past bookings.</p>
            ) : (
              past.map((b) => <BookingCard key={b.id} booking={b} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
