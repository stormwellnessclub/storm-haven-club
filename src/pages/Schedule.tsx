import { useState } from "react";
import { useClassSessions, ClassSession } from "@/hooks/useClassSessions";
import { useMyBookings } from "@/hooks/useBooking";
import { ClassCalendar } from "@/components/booking/ClassCalendar";
import { BookingModal } from "@/components/booking/BookingModal";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { startOfWeek, addWeeks, format } from "date-fns";

type CategoryFilter = "all" | "pilates_cycling" | "other";
type HeatFilter = "all" | boolean;

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: sessions = [], isLoading } = useClassSessions({
    weekOffset,
    category: categoryFilter,
    isHeated: heatFilter,
  });

  const { data: bookings = [] } = useMyBookings();
  const bookedSessionIds = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => b.session_id);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 });

  const handleBook = (session: ClassSession) => {
    setSelectedSession(session);
    setModalOpen(true);
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Class Schedule</h1>
          <p className="text-muted-foreground">
            Book your classes up to 3 weeks in advance
          </p>
        </div>

        {/* Filters and Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
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
              variant={categoryFilter === "pilates_cycling" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("pilates_cycling")}
            >
              Pilates & Cycling
            </Button>
            <Button
              variant={categoryFilter === "other" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("other")}
            >
              Other Classes
            </Button>
            <Button
              variant={heatFilter === true ? "destructive" : "outline"}
              size="sm"
              onClick={() => setHeatFilter(heatFilter === true ? "all" : true)}
            >
              <Flame className="h-4 w-4 mr-1" />
              Hot Only
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <ClassCalendar
          sessions={sessions}
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
