import { useState } from "react";
import { useClassSessions, ClassSession } from "@/hooks/useClassSessions";
import { useMyBookings } from "@/hooks/useBooking";
import { ClassCalendar } from "@/components/booking/ClassCalendar";
import { BookingModal } from "@/components/booking/BookingModal";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Flame, CircleDot, Bike, Activity } from "lucide-react";
import { startOfWeek, addWeeks, format } from "date-fns";

type CategoryFilter = "all" | "pilates" | "cycling" | "aerobics";
type HeatFilter = "all" | boolean;

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: sessions = [], isLoading } = useClassSessions({
    weekOffset,
    category: "all", // Get all, filter client-side for more granular control
    isHeated: heatFilter,
  });

  const { data: bookings = [] } = useMyBookings();
  const bookedSessionIds = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => b.session_id);

  // Filter sessions based on category
  const filteredSessions = sessions.filter((session) => {
    if (categoryFilter === "all") return true;
    
    const name = session.class_type.name.toLowerCase();
    const category = session.class_type.category;
    
    if (categoryFilter === "pilates") {
      return name.includes("pilates") || name.includes("reformer");
    }
    if (categoryFilter === "cycling") {
      return name.includes("cycle");
    }
    if (categoryFilter === "aerobics") {
      return category === "other" && !name.includes("pilates") && !name.includes("cycle");
    }
    return true;
  });

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 });

  const handleBook = (session: ClassSession) => {
    setSelectedSession(session);
    setModalOpen(true);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Book Your Classes</p>
            <h1 className="heading-display mb-4">Class Schedule</h1>
            <p className="text-muted-foreground text-lg">
              Book your classes up to 3 weeks in advance. Diamond members get 10 included classes per month.
            </p>
          </div>
        </div>
      </section>

      <div className="container py-8">
        {/* Filters and Navigation */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((prev) => Math.max(prev - 1, 0))}
              disabled={weekOffset === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              Week of {format(weekStart, "MMMM d, yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((prev) => Math.min(prev + 1, 2))}
              disabled={weekOffset >= 2}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("all")}
            >
              All Classes
            </Button>
            <Button
              variant={categoryFilter === "pilates" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("pilates")}
              className="gap-1"
            >
              <CircleDot className="h-4 w-4" />
              Reformer Pilates
            </Button>
            <Button
              variant={categoryFilter === "cycling" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("cycling")}
              className="gap-1"
            >
              <Bike className="h-4 w-4" />
              Cycling
            </Button>
            <Button
              variant={categoryFilter === "aerobics" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("aerobics")}
              className="gap-1"
            >
              <Activity className="h-4 w-4" />
              Aerobics
            </Button>
            <Button
              variant={heatFilter === true ? "destructive" : "outline"}
              size="sm"
              onClick={() => setHeatFilter(heatFilter === true ? "all" : true)}
              className="gap-1"
            >
              <Flame className="h-4 w-4" />
              Hot Only
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <ClassCalendar
          sessions={filteredSessions}
          isLoading={isLoading}
          onBook={handleBook}
          bookedSessionIds={bookedSessionIds}
          weekStartDate={weekStart}
        />

        {/* Booking Modal */}
        <BookingModal
          session={selectedSession}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </div>
    </Layout>
  );
}
