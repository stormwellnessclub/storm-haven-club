import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResumeBookingBanner } from "@/components/booking/ResumeBookingBanner";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpcomingBookings, usePastBookings, useCancelBooking } from "@/hooks/useBooking";
import { useMyReviews } from "@/hooks/useClassReviews";
import { ReviewDialog } from "@/components/reviews/ReviewDialog";
import { StarRating } from "@/components/reviews/StarRating";
import { LeaveReviewBanner } from "@/components/reviews/LeaveReviewBanner";
import { LeaveSpaReviewBanner } from "@/components/spa/LeaveSpaReviewBanner";
import { Calendar, Clock, MapPin, User, X, AlertTriangle, Star } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { hasSessionEnded } from "@/lib/clubTime";
import { CANCELLATION_POLICY_TEXT } from "@/components/booking/CancellationPolicyText";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAllAppointmentHistory } from "@/hooks/useAllAppointmentHistory";
import { SpaAppointmentRow } from "@/components/portal/SpaAppointmentRow";
import { PTAppointmentRow } from "@/components/portal/PTAppointmentRow";
import { UpcomingEventTickets } from "@/components/bookings/UpcomingEventTickets";

const REVIEWABLE_STATUSES = new Set(["confirmed", "completed", "no_show"]);

function canReviewClassBooking(booking: any): boolean {
  const session = booking?.session;
  return (
    REVIEWABLE_STATUSES.has(booking?.status) &&
    !session?.is_cancelled &&
    !!session?.class_type?.id &&
    hasSessionEnded(session?.session_date, session?.end_time)
  );
}

export default function MemberBookings() {
  const navigate = useNavigate();
  const { data: upcomingBookings, isLoading: upcomingLoading } = useUpcomingBookings();
  const { data: pastBookings, isLoading: pastLoading } = usePastBookings();
  const { data: myReviews = [] } = useMyReviews();
  const { upcomingSpa, pastSpa, upcomingPT, pastPT } = useAllAppointmentHistory();

  const reviewByBooking = Object.fromEntries(myReviews.map((r) => [r.booking_id, r]));

  const [reviewTarget, setReviewTarget] = useState<{
    bookingId: string; classTypeId: string; sessionId: string; className: string;
    existing?: { id: string; rating: number; review_text: string | null };
  } | null>(null);

  // Past bookings the user attended but hasn't reviewed yet
  const unreviewedPast = (pastBookings || []).filter(
    (b: any) =>
      canReviewClassBooking(b) &&
      !reviewByBooking[b.id]
  );

  const handleLeaveReviewFromBanner = () => {
    const next = unreviewedPast[0];
    if (!next) return;
    setReviewTarget({
      bookingId: next.id,
      classTypeId: next.session.class_type.id,
      sessionId: next.session_id,
      className: next.session.class_type.name || "Class",
      existing: undefined,
    });
  };

  return (
    <MemberLayout title="My Bookings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">View and manage your class bookings</p>
          <Button asChild><Link to="/schedule">Book a Class</Link></Button>
        </div>

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

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming
              {upcomingBookings && upcomingBookings.length > 0 && (
                <Badge variant="secondary" className="ml-2">{upcomingBookings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6 space-y-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Classes</h3>
              {upcomingLoading ? (
                <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
              ) : upcomingBookings && upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} isUpcoming reviewByBooking={reviewByBooking} onReview={setReviewTarget} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No upcoming classes.</p>
              )}
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

          <TabsContent value="past" className="mt-6 space-y-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Classes</h3>
              {pastLoading ? (
                <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
              ) : pastBookings && pastBookings.length > 0 ? (
                <div className="space-y-4">
                  {pastBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} isUpcoming={false} reviewByBooking={reviewByBooking} onReview={setReviewTarget} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No past classes.</p>
              )}
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
    </MemberLayout>
  );
}

interface BookingCardProps {
  booking: any;
  isUpcoming: boolean;
  reviewByBooking: Record<string, any>;
  onReview: (target: any) => void;
}

function BookingCard({ booking, isUpcoming, reviewByBooking, onReview }: BookingCardProps) {
  const session = booking.session;
  const classType = session?.class_type;
  const instructor = session?.instructor;
  const cancelBooking = useCancelBooking();
  const existingReview = reviewByBooking[booking.id];
  const canReview = canReviewClassBooking(booking);

  const isLateCancel = (() => {
    if (!session?.session_date || !session?.start_time) return false;
    const classStart = new Date(`${session.session_date}T${session.start_time}`);
    return differenceInHours(classStart, new Date()) < 24;
  })();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{classType?.name}</h3>
              {classType?.is_heated && <Badge variant="secondary">Heated</Badge>}
              {booking.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(parseISO(session?.session_date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatTime12h(session?.start_time)} - {formatTime12h(session?.end_time)}</span>
              </div>
              {session?.room && (
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{session.room}</span></div>
              )}
              {instructor && (
                <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{instructor.first_name} {instructor.last_name}</span></div>
              )}
            </div>
            {existingReview && (
              <StarRating rating={existingReview.rating} size="sm" />
            )}
          </div>

          <div className="flex flex-col gap-2 items-end">
            {isUpcoming && booking.status !== "cancelled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />Cancel
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
            {!isUpcoming && (canReview || existingReview) && (
              <Button
                variant="outline" size="sm"
                onClick={() => onReview({
                  bookingId: booking.id,
                  classTypeId: classType?.id,
                  sessionId: booking.session_id,
                  className: classType?.name || "Class",
                  existing: existingReview || undefined,
                })}
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                {existingReview ? "Edit Review" : "Leave Review"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
