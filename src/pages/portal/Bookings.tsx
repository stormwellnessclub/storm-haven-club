import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { ResumeBookingBanner } from "@/components/booking/ResumeBookingBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, differenceInHours } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, AlertTriangle, User, Star } from "lucide-react";
import { formatTime12h } from "@/lib/timeFormat";
import { hasSessionEnded } from "@/lib/clubTime";
import { useCancelBooking } from "@/hooks/useBooking";
import { CANCELLATION_POLICY_TEXT } from "@/components/booking/CancellationPolicyText";
import { useMyReviews } from "@/hooks/useClassReviews";
import { ReviewDialog } from "@/components/reviews/ReviewDialog";
import { StarRating } from "@/components/reviews/StarRating";
import { LeaveReviewBanner } from "@/components/reviews/LeaveReviewBanner";
import { LeaveSpaReviewBanner } from "@/components/spa/LeaveSpaReviewBanner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAllAppointmentHistory } from "@/hooks/useAllAppointmentHistory";
import { SpaAppointmentRow } from "@/components/portal/SpaAppointmentRow";
import { PTAppointmentRow } from "@/components/portal/PTAppointmentRow";

export default function PortalBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cancelBooking = useCancelBooking();
  const { data: myReviews = [] } = useMyReviews();
  const { upcomingSpa, pastSpa, upcomingPT, pastPT } = useAllAppointmentHistory();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["portal-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select(`
          *,
          class_sessions (
            session_date, start_time, end_time, room,
            class_types ( id, name, category, duration_minutes ),
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

  const upcoming = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      !hasSessionEnded(b.class_sessions?.session_date, b.class_sessions?.end_time)
  );
  const past = bookings.filter(
    (b) =>
      b.status !== "confirmed" ||
      hasSessionEnded(b.class_sessions?.session_date, b.class_sessions?.end_time)
  );

  // Map booking id -> review
  const reviewByBooking = Object.fromEntries(myReviews.map((r) => [r.booking_id, r]));

  const [reviewTarget, setReviewTarget] = useState<{
    bookingId: string; classTypeId: string; sessionId: string; className: string;
    existing?: { id: string; rating: number; review_text: string | null };
  } | null>(null);

  const BookingCard = ({ booking, showCancel = false, showReview = false }: { booking: any; showCancel?: boolean; showReview?: boolean }) => {
    const session = booking.class_sessions;
    const classType = session?.class_types;
    const instructor = session?.instructors;
    const sessionDate = session?.session_date ? parseISO(session.session_date) : null;
    const existingReview = reviewByBooking[booking.id];

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
              {existingReview && (
                <div className="mt-1">
                  <StarRating rating={existingReview.rating} size="sm" />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showReview && booking.status !== "cancelled" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewTarget({
                  bookingId: booking.id,
                  classTypeId: classType?.id,
                  sessionId: booking.session_id,
                  className: classType?.name || "Class",
                  existing: existingReview || undefined,
                })}
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                {existingReview ? "Edit" : "Review"}
              </Button>
            )}
            {showCancel && booking.status === "confirmed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={cancelBooking.isPending}>
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        {isLateCancel ? (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <span>This class starts in less than 24 hours. Your credit or pass <strong>will not be refunded</strong>.</span>
                          </div>
                        ) : (
                          <div>Your credit or pass will be refunded immediately.</div>
                        )}
                        <div className="text-xs bg-muted/50 rounded-md p-2">
                          <span className="font-medium text-foreground">Cancellation policy:</span> {CANCELLATION_POLICY_TEXT}
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cancelBooking.mutate(booking.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

  // Past bookings the non-member attended but hasn't reviewed yet
  const unreviewedPast = past.filter(
    (b: any) =>
      b?.status !== "cancelled" &&
      b?.class_sessions?.class_types?.id &&
      !reviewByBooking[b.id]
  );

  const handleLeaveReviewFromBanner = () => {
    const next = unreviewedPast[0];
    if (!next) return;
    setReviewTarget({
      bookingId: next.id,
      classTypeId: next.class_sessions.class_types.id,
      sessionId: next.session_id,
      className: next.class_sessions.class_types.name || "Class",
      existing: undefined,
    });
  };

  return (
    <PortalLayout title="My Bookings">
      <div className="max-w-3xl space-y-4">
        <ResumeBookingBanner
          kind="class"
          onResume={() => navigate("/schedule")}
        />
        <LeaveReviewBanner
          count={unreviewedPast.length}
          onLeaveReview={handleLeaveReviewFromBanner}
          dismissible
        />
        <LeaveSpaReviewBanner />
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length + upcomingSpa.length + upcomingPT.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length + pastSpa.length + pastPT.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-6 mt-4">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Classes</h3>
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming classes.</p>
              ) : upcoming.map((b) => <BookingCard key={b.id} booking={b} showCancel />)}
            </section>
            {upcomingSpa.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Spa & Recovery</h3>
                {upcomingSpa.map((a) => <SpaAppointmentRow key={a.id} appt={a} showCancel showIntake />)}
              </section>
            )}
            {upcomingPT.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Personal Training</h3>
                {upcomingPT.map((a) => <PTAppointmentRow key={a.id} appt={a} />)}
              </section>
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-6 mt-4">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Classes</h3>
              {past.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past classes.</p>
              ) : past.map((b) => <BookingCard key={b.id} booking={b} showReview />)}
            </section>
            {pastSpa.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Spa & Recovery</h3>
                {pastSpa.map((a) => <SpaAppointmentRow key={a.id} appt={a} />)}
              </section>
            )}
            {pastPT.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Personal Training</h3>
                {pastPT.map((a) => <PTAppointmentRow key={a.id} appt={a} />)}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onOpenChange={(open) => !open && setReviewTarget(null)}
          bookingId={reviewTarget.bookingId}
          classTypeId={reviewTarget.classTypeId}
          sessionId={reviewTarget.sessionId}
          className={reviewTarget.className}
          existingReview={reviewTarget.existing}
        />
      )}
    </PortalLayout>
  );
}
