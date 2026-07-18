import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useUpcomingBookings, usePastBookings, Booking } from "@/hooks/useBooking";
import { useMyReviews } from "@/hooks/useClassReviews";
import { LeaveReviewBanner } from "@/components/reviews/LeaveReviewBanner";
import { LeaveSpaReviewBanner } from "@/components/spa/LeaveSpaReviewBanner";
import { ReviewDialog } from "@/components/reviews/ReviewDialog";
import { useHealthScore, useHealthScoreHistory } from "@/hooks/useHealthScore";
import { useMemberPoints } from "@/hooks/useMemberPoints";
import { useAchievements, useMemberAchievements, useCheckAchievements } from "@/hooks/useAchievements";
import { ClassMilestonesCard } from "@/components/ClassMilestonesCard";
import { ClassTypeBreakdownCard } from "@/components/ClassTypeBreakdownCard";

import { useWorkoutLogs } from "@/hooks/useWorkoutLogs";
import { useHabits, useHabitStreaks } from "@/hooks/useHabits";
import { useHabitLogs, useCreateHabitLog } from "@/hooks/useHabitLogs";
import { useMemberGoals } from "@/hooks/useMemberGoals";
import { useMemberBenefitsStatus } from "@/hooks/useMemberBenefitsStatus";
import { Progress } from "@/components/ui/progress";
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
import { MyCafeOrdersCard } from "@/components/portal/MyCafeOrdersCard";
import { UpcomingPTAppointmentsCard } from "@/components/portal/UpcomingPTAppointmentsCard";
import { UpcomingSpaAppointmentsCard } from "@/components/portal/UpcomingSpaAppointmentsCard";
import { EventAnnouncementBanner } from "@/components/events/EventAnnouncementBanner";

import {
  CreditCard,
  Calendar,
  User,
  IdCard,
  ArrowRight,
  Ticket,
  Activity,
  Trophy,
  Dumbbell,
  CheckCircle2,
  Target,
  TrendingUp,
  TrendingDown,
  Lock,
  Zap,
  Snowflake,
  AlertTriangle,
  Gift,
  Flame,
  Star,
  CalendarPlus,
  Clock,
  Baby,
} from "lucide-react";
import { format, parseISO, isValid, startOfToday, differenceInDays } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { getCategoryDisplayName } from "@/lib/classCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { Habit } from "@/hooks/useHabits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EngagementNudge } from "@/components/member/EngagementNudge";

export default function MemberDashboard() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const { data: upcomingBookings, isLoading: bookingsLoading } = useUpcomingBookings();
  const { data: pastBookings } = usePastBookings();
  const { data: myReviews = [] } = useMyReviews();
  const { hasFrozenBenefits, frozenReason } = useMemberBenefitsStatus();

  // Unreviewed past classes (for the "Leave a Review" banner)
  const reviewByBooking = Object.fromEntries(myReviews.map((r) => [r.booking_id, r]));
  const unreviewedPast = (pastBookings || []).filter(
    (b: any) =>
      b?.status !== "cancelled" &&
      b?.session?.class_type?.id &&
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
      classTypeId: next.session.class_type.id,
      sessionId: next.session_id,
      className: next.session.class_type.name || "Class",
    });
  };
  
  // Health & Wellness Data
  const { data: healthScore, isLoading: healthScoreLoading } = useHealthScore(undefined, 30);
  const { data: healthScoreHistory } = useHealthScoreHistory(undefined, 2);
  const { data: memberPoints, isLoading: pointsLoading } = useMemberPoints();
  const { data: allAchievements } = useAchievements();
  const { data: achievements, isLoading: achievementsLoading } = useMemberAchievements();
  const { data: recentWorkouts, isLoading: workoutsLoading } = useWorkoutLogs(undefined, 3);
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: habitStreaks } = useHabitStreaks();
  const { data: activeGoals, isLoading: goalsLoading } = useMemberGoals(undefined, "active");
  const checkAchievements = useCheckAchievements();

  const isLoading = profileLoading || membershipLoading || creditsLoading;
  
  // Auto-check achievements once per session
  useEffect(() => {
    if (!user || sessionStorage.getItem("achievements_checked")) return;
    sessionStorage.setItem("achievements_checked", "1");
    checkAchievements.mutate(undefined);
  }, [user]);

  // Calculate health score trend
  const healthTrend = healthScoreHistory && healthScoreHistory.length >= 2
    ? healthScoreHistory[0].overall_score - healthScoreHistory[1].overall_score
    : 0;

  // Best streak across all habits
  const bestStreak = habitStreaks?.reduce((max, s) => Math.max(max, s.current_streak || 0), 0) || 0;

  // Next achievement teaser
  const nextAchievement = (() => {
    if (!allAchievements || !achievements) return null;
    const earnedTypes = new Set(achievements.map(a => a.achievement_type));
    const locked = allAchievements.filter(a => !earnedTypes.has(a.name));
    if (locked.length === 0) return null;
    return locked.sort((a, b) => (a.points_reward || 0) - (b.points_reward || 0))[0];
  })();

  // Most urgent goal (closest target date)
  const urgentGoal = activeGoals?.sort((a, b) => {
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
  })[0];

  const urgentGoalProgress = urgentGoal && urgentGoal.target_value > 0
    ? Math.min((urgentGoal.current_value / urgentGoal.target_value) * 100, 100)
    : 0;

  const urgentGoalDaysLeft = urgentGoal?.target_date
    ? differenceInDays(parseISO(urgentGoal.target_date), new Date())
    : null;

  // Helper to get frozen reason message
  const getFrozenReasonMessage = () => {
    switch (frozenReason) {
      case "pending_activation":
        return "Complete your membership activation to unlock all benefits.";
      case "past_due":
        return "Please update your payment method to restore your benefits.";
      case "frozen":
        return "Your membership is currently on hold.";
      case "cancelled":
        return "Your membership has been cancelled.";
      default:
        return "Your benefits are currently unavailable.";
    }
  };

  return (
    <MemberLayout title="Dashboard">
      <div className="space-y-8">
        {/* Upcoming Event Announcement */}
        <EventAnnouncementBanner />

        {/* Live cafe order tracker */}
        <MyCafeOrdersCard />

        {/* Leave a review prompt — premium nudge for unreviewed past classes */}
        <LeaveReviewBanner
          count={unreviewedPast.length}
          onLeaveReview={handleLeaveReviewFromBanner}
          dismissible
        />

        <LeaveSpaReviewBanner />

        {/* Frozen Benefits Notice */}
        {hasFrozenBenefits && (
          <AnimatedSection animation="fade-in">
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-sm">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">Benefits Frozen</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                {getFrozenReasonMessage()} Class credits, member pricing, and amenity access are unavailable until resolved.
                {frozenReason === "pending_activation" && (
                  <Button asChild size="sm" variant="gold" className="ml-4 mt-2 sm:mt-0">
                    <Link to="/member/membership">Activate Now</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          </AnimatedSection>
        )}

        {/* Guest Pass Promo Banner */}
        {!creditsLoading && credits?.guestPassCredits && credits.guestPassCredits.credits_remaining > 0 && (
          <AnimatedSection animation="fade-in">
            <Alert className="bg-accent/10 border-accent/30 shadow-sm">
              <Gift className="h-4 w-4 text-accent" />
              <AlertTitle className="text-foreground">You Have a Free Guest Pass!</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Invite a friend or family member for a complimentary visit this month.
                <Button asChild size="sm" variant="gold" className="ml-4 mt-2 sm:mt-0">
                  <Link to="/member/credits">Register Your Guest</Link>
                </Button>
              </AlertDescription>
            </Alert>
          </AnimatedSection>
        )}


        {/* Credit Expiration / Low Balance Warnings */}
        {!creditsLoading && (() => {
          const warnings: { label: string; message: string; icon: React.ReactNode }[] = [];
          const allCredits = [
            { credit: credits?.classCredits, label: "Class Credits", icon: <CreditCard className="h-4 w-4" /> },
            { credit: credits?.redLightCredits, label: "Red Light Therapy", icon: <Zap className="h-4 w-4" /> },
            { credit: credits?.dryCredits, label: "Dry Cryotherapy", icon: <Snowflake className="h-4 w-4" /> },
          ];
          allCredits.forEach(({ credit, label, icon }) => {
            if (!credit) return;
            const daysLeft = differenceInDays(parseISO(credit.expires_at), new Date());
            if (daysLeft <= 7 && daysLeft > 0 && credit.credits_remaining > 0) {
              warnings.push({ label, message: `${credit.credits_remaining} credits expiring in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`, icon });
            }
            if (credit.credits_remaining > 0 && credit.credits_remaining <= 2) {
              warnings.push({ label, message: `Only ${credit.credits_remaining} credit${credit.credits_remaining > 1 ? 's' : ''} remaining`, icon });
            }
          });
          if (warnings.length === 0) return null;
          return (
            <AnimatedSection animation="fade-in">
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">Credit Alerts</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  <ul className="mt-1 space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {w.icon}
                        <span className="font-medium">{w.label}:</span> {w.message}
                      </li>
                    ))}
                  </ul>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/member/wellness">Book Sessions</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            </AnimatedSection>
          );
        })()}

        {/* Welcome Header */}
        <AnimatedSection animation="fade-up" className="mb-2">
          {profileLoading ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <h2 className="heading-section">
              Welcome back, {profile?.first_name || "Member"}
            </h2>
          )}
          <p className="text-muted-foreground mt-1">
            Here's an overview of your membership
          </p>
        </AnimatedSection>

        {/* Engagement Nudge */}
        <EngagementNudge />

        {/* === Book Anything — 5-tile launcher === */}
        <AnimatedSection animation="fade-up" delay={50}>
          <Card variant="elevated" className="border-[hsl(var(--gold))]/20">
            <CardContent className="pt-6 pb-6">
              
              <div className="grid grid-cols-5 gap-2">
                {[
                  { to: "/member/book/class", icon: Dumbbell, label: "Book Class" },
                  { to: "/member/wellness", icon: Zap, label: "Book Amenity" },
                  { to: "/spa", icon: Flame, label: "Spa Aella" },
                  { to: "/member/cafe", icon: CreditCard, label: "Café Order" },
                  { to: "/class-passes", icon: Ticket, label: "Buy Passes" },
                ].map((t) => (
                  <Link
                    key={t.to + t.label}
                    to={t.to}
                    className="flex flex-col items-center gap-2 text-center group"
                  >
                    <div className="h-14 w-14 rounded-full bg-[hsl(var(--gold))]/15 flex items-center justify-center text-[hsl(var(--accent))] group-hover:bg-[hsl(var(--gold))]/25 transition-colors">
                      <t.icon className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium text-foreground/80 leading-tight">
                      {t.label}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection animation="fade-up" delay={60}>
          <UpcomingPTAppointmentsCard />
          <UpcomingSpaAppointmentsCard />
        </AnimatedSection>

        {/* === NEW: Up Next - Upcoming Bookings at top === */}
        <AnimatedSection animation="fade-up" delay={80}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Up Next
            </h3>
            <Button asChild variant="outline" size="sm">
              <Link to="/member/bookings">View All</Link>
            </Button>
          </div>
          {bookingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : upcomingBookings && upcomingBookings.length > 0 ? (
            <div className="space-y-2">
              {upcomingBookings.slice(0, 3).map((booking: Booking) => {
                const sessionDate = booking.session?.session_date 
                  ? parseISO(booking.session.session_date) 
                  : null;
                const formattedDate = sessionDate && isValid(sessionDate) 
                  ? format(sessionDate, "EEE, MMM d") 
                  : "Date TBA";
                const formattedTime = formatTime12h(booking.session?.start_time);
                
                return (
                  <Card key={booking.id} variant="flat" className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-accent/10 shrink-0">
                          <Calendar className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {booking.session?.class_type?.name || "Class"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formattedDate} · {formattedTime}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {booking.session?.room || "Studio"}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card variant="flat" className="p-6 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming bookings</p>
              <Button asChild variant="link" size="sm" className="mt-1">
                <Link to="/schedule">Browse Schedule</Link>
              </Button>
            </Card>
          )}
        </AnimatedSection>

        {/* Quick Stats */}
        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" staggerDelay={80}>
          {/* Membership Status */}
          <Card variant="interactive" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Membership</CardTitle>
              <div className="p-2 rounded-full bg-accent/10">
                <IdCard className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              {membershipLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : membership ? (
                <>
                  <div className="text-2xl font-bold font-serif">{membership.membership_type}</div>
                  <Badge variant={membership.status === "active" ? "default" : "secondary"} className="mt-1">
                    {membership.status}
                  </Badge>
                </>
              ) : (
                <div className="text-muted-foreground">No membership</div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Credits */}
          <Card variant="interactive" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Credits</CardTitle>
              <div className="p-2 rounded-full bg-accent/10">
                <CreditCard className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : credits?.classCredits ? (
                <>
                  <div className="text-2xl font-bold font-serif">
                    {credits.classCredits.credits_remaining}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {credits.classCredits.credits_total} remaining
                  </p>
                </>
              ) : (
                <div className="text-muted-foreground">No credits</div>
              )}
            </CardContent>
          </Card>

          {/* Class Passes */}
          <Card variant="interactive" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Class Passes</CardTitle>
              <div className="p-2 rounded-full bg-accent/10">
                <Ticket className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : credits?.classPasses && credits.classPasses.length > 0 ? (
                <div className="space-y-3">
                  {credits.classPasses.map((pass) => {
                    const pct = (pass.classes_remaining / pass.classes_total) * 100;
                    const expiresDate = parseISO(pass.expires_at);
                    const daysLeft = differenceInDays(expiresDate, new Date());
                    return (
                      <div key={pass.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {getCategoryDisplayName(pass.category)} — {pass.pass_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {pass.classes_remaining}/{pass.classes_total}
                          </span>
                        </div>
                        <p className={`text-xs ${daysLeft <= 14 ? "text-destructive" : "text-muted-foreground"}`}>
                          Expires {format(expiresDate, "MMM d, yyyy")}
                        </p>
                      </div>
                    );
                  })}
                  <Link to="/member/credits" className="text-xs text-primary hover:underline mt-1 inline-block">
                    View details →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No active passes</p>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/class-passes">Buy Passes</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Bookings count */}
          <Card variant="interactive" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Classes</CardTitle>
              <div className="p-2 rounded-full bg-accent/10">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold font-serif">
                    {upcomingBookings?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">booked classes</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Red Light Therapy Credits */}
          {credits?.redLightCredits && (
            <Card variant="interactive" className="hover-lift-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Red Light Therapy</CardTitle>
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                  <Zap className="h-4 w-4 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-serif">
                  {credits.redLightCredits.credits_remaining}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {credits.redLightCredits.credits_total} sessions
                </p>
              </CardContent>
            </Card>
          )}

          {/* Dry Cryo Credits */}
          {credits?.dryCredits && (
            <Card variant="interactive" className="hover-lift-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Dry Cryotherapy</CardTitle>
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Snowflake className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-serif">
                  {credits.dryCredits.credits_remaining}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {credits.dryCredits.credits_total} sessions
                </p>
              </CardContent>
            </Card>
          )}
        </StaggerContainer>

        {/* Health & Wellness Overview */}
        <AnimatedSection animation="fade-up" delay={100}>
          <h3 className="text-lg font-semibold mb-4">Health & Wellness</h3>
        </AnimatedSection>

        {/* Daily Check-In + Streak Banner */}
        <AnimatedSection animation="fade-up" delay={80}>
          <Card variant="elevated" className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-accent/10">
                    <Flame className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Daily Check-In</h3>
                    <p className="text-sm text-muted-foreground">
                      {bestStreak > 0 ? `🔥 ${bestStreak}-day streak!` : "Start your streak today"}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/member/habits">All Habits</Link>
                </Button>
              </div>
              {habitsLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : habits && habits.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {habits.slice(0, 4).map((habit) => (
                    <HabitCheckbox key={habit.id} habit={habit} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No habits yet — <Link to="/member/habits" className="text-accent underline">create one</Link> to start tracking.
                </p>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" staggerDelay={60}>
          {/* Health Score Widget */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Health Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthScoreLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : healthScore ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold">{healthScore.overall_score}</div>
                    <div className="text-sm text-muted-foreground">/ 100</div>
                    {healthTrend !== 0 && (
                      <div className={`flex items-center gap-1 ${healthTrend > 0 ? 'text-success' : 'text-destructive'}`}>
                        {healthTrend > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="text-xs">{Math.abs(healthTrend)}</span>
                      </div>
                    )}
                  </div>
                  <Progress value={healthScore.overall_score} className="mt-2" />
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Activity ({healthScore.activity_counts.workouts + healthScore.activity_counts.classes + healthScore.activity_counts.check_ins})</span>
                      <span>{healthScore.activity_score}/40</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consistency ({healthScore.activity_counts.unique_days} days)</span>
                      <span>{healthScore.consistency_score}/30</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Goal Progress</span>
                      <span>{healthScore.goal_progress_score}/30</span>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/health-score">
                      View Details <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="text-muted-foreground text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          {/* Next Achievement Teaser */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Achievements</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {pointsLoading || achievementsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold">{achievements?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">unlocked</div>
                  </div>
                  {nextAchievement && (
                    <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/10">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Star className="h-3 w-3 text-accent" />
                        <span>Next Achievement</span>
                      </div>
                      <p className="text-sm font-medium">{nextAchievement.name}</p>
                      {nextAchievement.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{nextAchievement.description}</p>
                      )}
                    </div>
                  )}
                  {achievements && achievements.length > 0 && !nextAchievement && (
                    <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/10 text-center">
                      <p className="text-sm font-medium text-accent">🎉 All achievements earned!</p>
                    </div>
                  )}
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/achievements">
                      View All <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Class Milestones */}
          <ClassMilestonesCard />
          <ClassTypeBreakdownCard />




          {/* Workouts Widget */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recent Workouts</CardTitle>
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {workoutsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : recentWorkouts && recentWorkouts.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {recentWorkouts.slice(0, 2).map((workout) => (
                      <div key={workout.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{workout.workout_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(workout.performed_at), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/workouts">
                      {recentWorkouts.length >= 3 ? "View All" : "Log Workout"} <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">No workouts logged yet</p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/member/workouts">
                      Log Workout <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Goals Widget - Enhanced */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : urgentGoal ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" className="text-secondary" />
                        <circle
                          cx="28" cy="28" r="24"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-accent"
                          strokeDasharray={`${(urgentGoalProgress / 100) * 150.8} 150.8`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        {Math.round(urgentGoalProgress)}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{urgentGoal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {urgentGoal.current_value} / {urgentGoal.target_value} {urgentGoal.unit || ""}
                      </p>
                      {urgentGoalDaysLeft !== null && urgentGoalDaysLeft >= 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {urgentGoalDaysLeft} day{urgentGoalDaysLeft !== 1 ? "s" : ""} remaining
                        </p>
                      )}
                    </div>
                  </div>
                  {activeGoals && activeGoals.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-2">+ {activeGoals.length - 1} more active goal{activeGoals.length > 2 ? "s" : ""}</p>
                  )}
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/goals">
                      View Goals <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">No active goals</p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/member/goals">
                      Create Goal <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </StaggerContainer>
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
    </MemberLayout>
  );
}

// Habit Checkbox Component
function HabitCheckbox({ habit }: { habit: Habit }) {
  const today = format(startOfToday(), "yyyy-MM-dd");
  const { data: todayLogs } = useHabitLogs(habit.id, undefined, {
    start: startOfToday(),
    end: startOfToday(),
  });
  const createLog = useCreateHabitLog();
  const isChecked = todayLogs && todayLogs.length > 0;

  const handleToggle = async () => {
    if (isChecked) return;
    await createLog.mutateAsync({
      habit_id: habit.id,
      logged_value: habit.target_value || 1,
      logged_date: today,
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-background/60 border border-border/50">
      <Checkbox
        checked={!!isChecked}
        onCheckedChange={handleToggle}
        disabled={createLog.isPending}
      />
      <label className="flex-1 cursor-pointer" onClick={handleToggle}>
        {habit.name}
      </label>
      {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />}
    </div>
  );
}
