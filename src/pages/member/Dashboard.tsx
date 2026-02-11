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
import { useUpcomingBookings, Booking } from "@/hooks/useBooking";
import { useHealthScore, useHealthScoreHistory } from "@/hooks/useHealthScore";
import { useMemberPoints } from "@/hooks/useMemberPoints";
import { useMemberAchievements } from "@/hooks/useAchievements";
import { useWorkoutLogs } from "@/hooks/useWorkoutLogs";
import { useHabits, useHabitStreaks } from "@/hooks/useHabits";
import { useHabitLogs, useCreateHabitLog } from "@/hooks/useHabitLogs";
import { useMemberGoals } from "@/hooks/useMemberGoals";
import { useMemberBenefitsStatus } from "@/hooks/useMemberBenefitsStatus";
import { Progress } from "@/components/ui/progress";
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
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
} from "lucide-react";
import { format, parseISO, isValid, startOfToday, differenceInDays } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { Checkbox } from "@/components/ui/checkbox";
import { Habit } from "@/hooks/useHabits";

export default function MemberDashboard() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const { data: upcomingBookings, isLoading: bookingsLoading } = useUpcomingBookings();
  const { hasFrozenBenefits, frozenReason } = useMemberBenefitsStatus();
  
  // Health & Wellness Data
  const { data: healthScore, isLoading: healthScoreLoading } = useHealthScore(undefined, 30);
  const { data: healthScoreHistory } = useHealthScoreHistory(undefined, 2);
  const { data: memberPoints, isLoading: pointsLoading } = useMemberPoints();
  const { data: achievements, isLoading: achievementsLoading } = useMemberAchievements();
  const { data: recentWorkouts, isLoading: workoutsLoading } = useWorkoutLogs(undefined, 3);
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: activeGoals, isLoading: goalsLoading } = useMemberGoals(undefined, "active");

  const isLoading = profileLoading || membershipLoading || creditsLoading;
  
  // Calculate health score trend
  const healthTrend = healthScoreHistory && healthScoreHistory.length >= 2
    ? healthScoreHistory[0].overall_score - healthScoreHistory[1].overall_score
    : 0;

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
              ) : (
                <>
                  <div className="text-2xl font-bold font-serif">
                    {credits?.classPasses?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">active passes</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Bookings */}
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

          {/* Red Light Therapy Credits - Show for Gold/Platinum/Diamond */}
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

          {/* Dry Cryo Credits - Show for Gold/Platinum/Diamond */}
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
                      <span className="text-muted-foreground">Activity</span>
                      <span>{healthScore.activity_score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consistency</span>
                      <span>{healthScore.consistency_score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Goals</span>
                      <span>{healthScore.goal_progress_score}</span>
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

          {/* Achievements & Points Widget */}
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
                    <div className="text-3xl font-bold">{memberPoints?.total_points || 0}</div>
                    <div className="text-sm text-muted-foreground">points</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Current Streak</span>
                      <span className="font-medium">{memberPoints?.current_streak_days || 0} days</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Achievements</span>
                      <span className="font-medium">{achievements?.length || 0} unlocked</span>
                    </div>
                    {achievements && achievements.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Recent:</p>
                        <p className="text-xs font-medium truncate">
                          {achievements[0]?.achievement?.name || "—"}
                        </p>
                      </div>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/achievements">
                      View All <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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

          {/* Habits Widget */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Habits</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {habitsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : habits && habits.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {habits.slice(0, 3).map((habit) => (
                      <HabitCheckbox key={habit.id} habit={habit} />
                    ))}
                  </div>
                  {habits.length > 3 && (
                    <Button asChild variant="outline" size="sm" className="w-full mt-3">
                      <Link to="/member/habits">
                        View All ({habits.length}) <ArrowRight className="h-3 w-3 ml-2" />
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">No habits set up yet</p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/member/habits">
                      Create Habit <ArrowRight className="h-3 w-3 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Goals Widget */}
          <Card variant="elevated" className="hover-lift-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : activeGoals && activeGoals.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {activeGoals.slice(0, 2).map((goal) => {
                      const progress = goal.target_value && goal.target_value > 0
                        ? (goal.current_value / goal.target_value) * 100
                        : 0;
                      return (
                        <div key={goal.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="truncate">{goal.title}</span>
                            <span>{Math.min(progress, 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(progress, 100)} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full mt-3">
                    <Link to="/member/goals">
                      {activeGoals.length > 2 ? `View All (${activeGoals.length})` : "View Goals"} <ArrowRight className="h-3 w-3 ml-2" />
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

        {/* Quick Actions */}
        <AnimatedSection animation="fade-up" delay={150}>
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        </AnimatedSection>
        <StaggerContainer className="grid gap-4 md:grid-cols-3" staggerDelay={80}>
          <Card variant="interactive" className="hover-lift-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-accent/10">
                    <Calendar className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Book a Class</h3>
                    <p className="text-sm text-muted-foreground">View schedule and book</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/schedule">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="hover-lift-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-accent/10">
                    <User className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Update Profile</h3>
                    <p className="text-sm text-muted-foreground">Manage your info</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/member/profile">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="hover-lift-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-accent/10">
                    <Ticket className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Buy Class Passes</h3>
                    <p className="text-sm text-muted-foreground">Get more classes</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/class-passes">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerContainer>

        {/* Upcoming Bookings Preview */}
        <AnimatedSection animation="fade-up" delay={200}>
          <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Classes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/member/bookings">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : upcomingBookings && upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.slice(0, 3).map((booking: Booking) => {
                  const sessionDate = booking.session?.session_date 
                    ? parseISO(booking.session.session_date) 
                    : null;
                  const formattedDate = sessionDate && isValid(sessionDate) 
                    ? format(sessionDate, "EEEE, MMM d") 
                    : "Date TBA";
                  const formattedTime = formatTime12h(booking.session?.start_time);
                  
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                    >
                      <div>
                        <p className="font-medium">
                          {booking.session?.class_type?.name || "Class"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formattedDate} at {formattedTime}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {booking.session?.room || "Studio"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No upcoming classes</p>
                <Button asChild variant="link" className="mt-2">
                  <Link to="/schedule">Browse Schedule</Link>
                </Button>
              </div>
            )}
          </CardContent>
          </Card>
        </AnimatedSection>
      </div>
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
    if (isChecked) {
      // For simplicity, we'll just show a message - full deletion can be done on habits page
      return;
    } else {
      await createLog.mutateAsync({
        habit_id: habit.id,
        logged_value: habit.target_value || 1,
        logged_date: today,
      });
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={!!isChecked}
        onCheckedChange={handleToggle}
        disabled={createLog.isPending}
      />
      <label className="flex-1 cursor-pointer" onClick={handleToggle}>
        {habit.name}
      </label>
    </div>
  );
}
