import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";

export default function PortalBookings() {
  const { user } = useAuth();

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
            class_types ( name, category, duration_minutes )
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

  const BookingCard = ({ booking }: { booking: any }) => {
    const session = booking.class_sessions;
    const classType = session?.class_types;

    return (
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">{classType?.name || "Class"}</p>
              <p className="text-sm text-muted-foreground">
                {session?.session_date
                  ? format(new Date(session.session_date), "MMM d, yyyy")
                  : "—"}{" "}
                · {session?.start_time?.slice(0, 5) || ""}
              </p>
            </div>
          </div>
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.status}
          </Badge>
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
              upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
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
