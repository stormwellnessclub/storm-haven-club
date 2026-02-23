import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpcomingBookings, usePastBookings, useCancelBooking } from "@/hooks/useBooking";
import { Calendar, Clock, MapPin, User, X, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
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

export default function MemberBookings() {
  const { data: upcomingBookings, isLoading: upcomingLoading } = useUpcomingBookings();
  const { data: pastBookings, isLoading: pastLoading } = usePastBookings();

  return (
    <MemberLayout title="My Bookings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            View and manage your class bookings
          </p>
          <Button asChild>
            <Link to="/schedule">Book a Class</Link>
          </Button>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming
              {upcomingBookings && upcomingBookings.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {upcomingBookings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {upcomingLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : upcomingBookings && upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking: any) => (
                  <BookingCard key={booking.id} booking={booking} isUpcoming />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">No Upcoming Classes</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    You haven't booked any classes yet. Browse our schedule to find classes that fit your routine.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild>
                      <Link to="/schedule">Browse Schedule</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/class-passes">Buy Class Passes</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : pastBookings && pastBookings.length > 0 ? (
              <div className="space-y-4">
                {pastBookings.map((booking: any) => (
                  <BookingCard key={booking.id} booking={booking} isUpcoming={false} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No past bookings</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MemberLayout>
  );
}

interface BookingCardProps {
  booking: any;
  isUpcoming: boolean;
}

function BookingCard({ booking, isUpcoming }: BookingCardProps) {
  // Use correct property names from query alias (session, class_type, instructor)
  const session = booking.session;
  const classType = session?.class_type;
  const instructor = session?.instructor;
  
  const cancelBooking = useCancelBooking();

  const isLateCancel = (() => {
    if (!session?.session_date || !session?.start_time) return false;
    const classStart = new Date(`${session.session_date}T${session.start_time}`);
    return differenceInHours(classStart, new Date()) < 24;
  })();

  const handleCancel = () => {
    cancelBooking.mutate(booking.id);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{classType?.name}</h3>
              {classType?.is_heated && (
                <Badge variant="secondary">Heated</Badge>
              )}
              {booking.status === "cancelled" && (
                <Badge variant="destructive">Cancelled</Badge>
              )}
            </div>
            
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(parseISO(session?.session_date), "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime12h(session?.start_time)} - {formatTime12h(session?.end_time)}
                </span>
              </div>
              {session?.room && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{session.room}</span>
                </div>
              )}
              {instructor && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{instructor.first_name} {instructor.last_name}</span>
                </div>
              )}
            </div>
          </div>

          {isUpcoming && booking.status !== "cancelled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4 mr-1" />
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
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLateCancel ? "Cancel Anyway" : "Yes, Cancel"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
