import { useUpcomingBookings, usePastBookings, useCancelBooking, Booking } from "@/hooks/useBooking";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, User, Flame, X } from "lucide-react";
import { format, parse, parseISO, differenceInHours } from "date-fns";
import { Navigate, Link } from "react-router-dom";

function BookingCard({ booking, showCancel = false }: { booking: Booking; showCancel?: boolean }) {
  const cancelBooking = useCancelBooking();
  const sessionDate = parseISO(booking.session.session_date);
  const startTime = parse(booking.session.start_time, "HH:mm:ss", new Date());
  const sessionDateTime = new Date(`${booking.session.session_date}T${booking.session.start_time}`);
  const hoursUntilClass = differenceInHours(sessionDateTime, new Date());
  const isLateCancel = hoursUntilClass < 24 && hoursUntilClass > 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{booking.session.class_type.name}</h3>
              {booking.session.class_type.is_heated && (
                <Badge variant="destructive" className="text-xs">
                  <Flame className="h-3 w-3 mr-1" />Hot
                </Badge>
              )}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(sessionDate, "EEEE, MMMM d")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{format(startTime, "h:mm a")}</span>
              </div>
              {booking.session.instructor && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{booking.session.instructor.first_name} {booking.session.instructor.last_name}</span>
                </div>
              )}
              {booking.session.room && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{booking.session.room}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
              {booking.status}
            </Badge>
            {showCancel && booking.status === "confirmed" && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => cancelBooking.mutate(booking.id)}
                  disabled={cancelBooking.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  {isLateCancel ? "Cancel (forfeit credit)" : "Cancel"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyBookings() {
  const { user, loading } = useAuth();
  const { data: upcomingBookings, isLoading: upcomingLoading } = useUpcomingBookings();
  const { data: pastBookings, isLoading: pastLoading } = usePastBookings();

  if (loading) return <Layout><div className="container py-8"><Skeleton className="h-64 w-full" /></div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Bookings</h1>
            <p className="text-muted-foreground">Manage your class reservations</p>
          </div>
          <Button asChild>
            <Link to="/schedule">Book a Class</Link>
          </Button>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingBookings?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastBookings?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
            ) : upcomingBookings?.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                No upcoming bookings. <Link to="/schedule" className="text-primary hover:underline">Book a class</Link>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {upcomingBookings?.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} showCancel />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
            ) : pastBookings?.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No past bookings</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {pastBookings?.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
