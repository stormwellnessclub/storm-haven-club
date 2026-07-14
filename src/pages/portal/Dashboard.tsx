import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarPlus, Ticket, Zap, CreditCard, Calendar, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, differenceInDays } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { getCategoryDisplayName } from "@/lib/classCategories";
import { MyCafeOrdersCard } from "@/components/portal/MyCafeOrdersCard";
import { MyCafeCreditCard } from "@/components/portal/MyCafeCreditCard";
import { UpcomingPTAppointmentsCard } from "@/components/portal/UpcomingPTAppointmentsCard";
import { UpcomingSpaAppointmentsCard } from "@/components/portal/UpcomingSpaAppointmentsCard";
import { useMyReviews } from "@/hooks/useClassReviews";
import { LeaveReviewBanner } from "@/components/reviews/LeaveReviewBanner";
import { LeaveSpaReviewBanner } from "@/components/spa/LeaveSpaReviewBanner";
import { ReviewDialog } from "@/components/reviews/ReviewDialog";
import { ClassMilestonesCard } from "@/components/ClassMilestonesCard";
import { EventVoteCard } from "@/components/events/EventVoteCard";


export default function PortalDashboard() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useNonMemberProfile();

  // Get upcoming bookings with details
  const { data: upcomingBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["portal-upcoming-bookings", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("class_bookings")
        .select(`
          id,
          status,
          class_sessions (
            session_date,
            start_time,
            end_time,
            room,
            class_types ( name, category, duration_minutes )
          )
        `)
        .eq("user_id", user!.id)
        .eq("status", "confirmed")
        .gte("class_sessions.session_date", today)
        .order("booked_at", { ascending: true });
      if (error) throw error;
      // Filter out rows where the join didn't match (session_date < today)
      return (data || []).filter((b: any) => b.class_sessions?.session_date >= today);
    },
    enabled: !!user,
  });

  // Get active passes with full details
  const { data: activePasses = [], isLoading: passesLoading } = useQuery({
    queryKey: ["portal-active-passes-detail", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gt("classes_remaining", 0)
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Get active guest passes for this user
  const { data: guestPasses = [], isLoading: guestPassesLoading } = useQuery({
    queryKey: ["portal-guest-passes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_passes")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const hasCard = profile?.card_last4;
  const firstName = profile?.first_name || user?.user_metadata?.first_name || "there";

  // Past bookings for the "Leave a Review" banner
  const { data: pastBookings = [] } = useQuery({
    queryKey: ["portal-past-bookings", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("class_bookings")
        .select(`
          id, status, session_id,
          class_sessions (
            session_date, start_time,
            class_types ( id, name )
          )
        `)
        .eq("user_id", user!.id)
        .order("booked_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((b: any) => b.class_sessions?.session_date < today);
    },
    enabled: !!user,
  });
  const { data: myReviews = [] } = useMyReviews();
  const reviewByBooking = Object.fromEntries(myReviews.map((r) => [r.booking_id, r]));
  const unreviewedPast = pastBookings.filter(
    (b: any) =>
      b?.status !== "cancelled" &&
      b?.class_sessions?.class_types?.id &&
      !reviewByBooking[b.id]
  );
  const [reviewTarget, setReviewTarget] = useState<{
    bookingId: string; classTypeId: string; sessionId: string; className: string;
  } | null>(null);
  const handleLeaveReviewFromBanner = () => {
    const next = unreviewedPast[0];
    if (!next) return;
    setReviewTarget({
      bookingId: next.id,
      classTypeId: next.class_sessions.class_types.id,
      sessionId: next.session_id,
      className: next.class_sessions.class_types.name || "Class",
    });
  };

  return (
    <PortalLayout title="Dashboard">
      <div className="space-y-6 max-w-4xl">
        {/* Welcome */}
        <div>
          <h2 className="heading-section">Welcome back, {firstName}</h2>
          <p className="text-muted-foreground mt-1">Manage your classes, passes, and bookings.</p>
        </div>

        {/* Member Vote — Sound Bath */}
        <EventVoteCard voterType="non_member" />

        {/* Live cafe order tracker */}
        <MyCafeOrdersCard />
        <MyCafeCreditCard />

        {/* Leave a review prompt — premium nudge for unreviewed past classes */}
        <LeaveReviewBanner
          count={unreviewedPast.length}
          onLeaveReview={handleLeaveReviewFromBanner}
          dismissible
        />

        <LeaveSpaReviewBanner />

        {!profileLoading && !hasCard && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-4 py-4">
              <CreditCard className="h-8 w-8 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Payment method required</p>
                <p className="text-sm text-muted-foreground">
                  Add a card on file to book classes, purchase passes, and use other services.
                </p>
              </div>
              <Button asChild>
                <Link to="/portal/payment-methods">Add Card</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <UpcomingPTAppointmentsCard />
        <UpcomingSpaAppointmentsCard />
        <ClassMilestonesCard />

        {/* Upcoming Bookings - Detailed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Classes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/portal/bookings">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.slice(0, 3).map((booking: any) => {
                  const session = booking.class_sessions;
                  const classType = session?.class_types;
                  const sessionDate = session?.session_date ? parseISO(session.session_date) : null;
                  return (
                    <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">{classType?.name || "Class"}</p>
                          <p className="text-sm text-muted-foreground">
                            {sessionDate ? format(sessionDate, "EEEE, MMM d") : "Date TBA"} · {formatTime12h(session?.start_time)}
                          </p>
                        </div>
                      </div>
                      {session?.room && (
                        <Badge variant="outline">{session.room}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming classes</p>
                <Button asChild variant="link" size="sm" className="mt-1">
                  <Link to="/schedule">Browse Schedule</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Passes - Detailed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Passes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/portal/passes">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {passesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
              </div>
            ) : activePasses.length > 0 ? (
              <div className="space-y-4">
                {activePasses.map((pass: any) => {
                  const pct = (pass.classes_remaining / pass.classes_total) * 100;
                  const expiresDate = parseISO(pass.expires_at);
                  const daysLeft = differenceInDays(expiresDate, new Date());
                  return (
                    <div key={pass.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {getCategoryDisplayName(pass.category)} — {pass.pass_type}
                        </span>
                        <span className="text-xs font-semibold">
                          {pass.classes_remaining}/{pass.classes_total}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className={`text-xs ${daysLeft <= 14 ? "text-destructive" : "text-muted-foreground"}`}>
                        Expires {format(expiresDate, "MMM d, yyyy")}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active passes</p>
                <Button asChild variant="link" size="sm" className="mt-1">
                  <Link to="/class-passes">Buy Passes</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guest Passes */}
        {!guestPassesLoading && guestPasses.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Guest Passes</CardTitle>
              <Badge variant="secondary">{guestPasses.length} active</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {guestPasses.map((pass: any) => {
                  const daysLeft = differenceInDays(parseISO(pass.expires_at), new Date());
                  return (
                    <div key={pass.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <Gift className="h-5 w-5 text-accent shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Guest Pass</p>
                          <p className={`text-xs ${daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                            Expires {format(parseISO(pass.expires_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/schedule">
                <CalendarPlus className="h-5 w-5" />
                <span>Book a Class</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/class-passes">
                <Ticket className="h-5 w-5" />
                <span>Buy Passes</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/portal/wellness">
                <Zap className="h-5 w-5" />
                <span>Book Recovery</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onOpenChange={(open) => !open && setReviewTarget(null)}
          bookingId={reviewTarget.bookingId}
          classTypeId={reviewTarget.classTypeId}
          sessionId={reviewTarget.sessionId}
          className={reviewTarget.className}
        />
      )}
    </PortalLayout>
  );
}
