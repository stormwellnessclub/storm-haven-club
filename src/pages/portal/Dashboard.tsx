import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Ticket, Zap, CreditCard, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalDashboard() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useNonMemberProfile();

  // Get upcoming bookings count
  const { data: upcomingCount = 0 } = useQuery({
    queryKey: ["portal-upcoming-count", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from("class_bookings")
        .select("*, class_sessions!inner(session_date)", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "confirmed")
        .gte("class_sessions.session_date", today);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Get active passes count
  const { data: activePasses = 0 } = useQuery({
    queryKey: ["portal-active-passes", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("class_passes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gt("classes_remaining", 0);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const hasCard = profile?.card_last4;
  const firstName = profile?.first_name || user?.user_metadata?.first_name || "there";

  return (
    <PortalLayout title="Dashboard">
      <div className="space-y-6 max-w-4xl">
        {/* Welcome */}
        <div>
          <h2 className="heading-section">Welcome back, {firstName}</h2>
          <p className="text-muted-foreground mt-1">Manage your classes, passes, and bookings.</p>
        </div>

        {/* Card on file prompt */}
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{upcomingCount}</span>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Passes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{activePasses}</span>
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
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
    </PortalLayout>
  );
}
