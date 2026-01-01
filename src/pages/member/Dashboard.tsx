import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useUpcomingBookings } from "@/hooks/useBooking";
import {
  CreditCard,
  Calendar,
  User,
  IdCard,
  ArrowRight,
  Ticket,
} from "lucide-react";
import { format } from "date-fns";

export default function MemberDashboard() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const { data: upcomingBookings, isLoading: bookingsLoading } = useUpcomingBookings();

  const isLoading = profileLoading || membershipLoading || creditsLoading;

  return (
    <MemberLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="mb-8">
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
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Membership Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Membership</CardTitle>
              <IdCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {membershipLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : membership ? (
                <>
                  <div className="text-2xl font-bold">{membership.membership_type}</div>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Credits</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : credits?.memberCredits ? (
                <>
                  <div className="text-2xl font-bold">
                    {credits.memberCredits.credits_remaining}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {credits.memberCredits.credits_total} remaining
                  </p>
                </>
              ) : (
                <div className="text-muted-foreground">No credits</div>
              )}
            </CardContent>
          </Card>

          {/* Class Passes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Class Passes</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {credits?.classPasses?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">active passes</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Classes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {upcomingBookings?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">booked classes</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-accent" />
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

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-accent" />
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

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="h-8 w-8 text-accent" />
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
        </div>

        {/* Upcoming Bookings Preview */}
        <Card>
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
                {upcomingBookings.slice(0, 3).map((booking: any) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium">{booking.class_sessions?.class_types?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.class_sessions?.session_date), "EEEE, MMM d")} at{" "}
                        {booking.class_sessions?.start_time?.slice(0, 5)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {booking.class_sessions?.room || "Studio"}
                    </Badge>
                  </div>
                ))}
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
      </div>
    </MemberLayout>
  );
}
