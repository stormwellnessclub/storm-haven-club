import { useState } from "react";
import { useClassSessions, ClassSession } from "@/hooks/useClassSessions";
import { useMyBookings } from "@/hooks/useBooking";
import { ClassCalendar } from "@/components/booking/ClassCalendar";
import { BookingModal } from "@/components/booking/BookingModal";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Flame, CircleDot, Bike, Activity, Sun, Moon, Calendar } from "lucide-react";
import { startOfWeek, addWeeks, addDays, format, parse } from "date-fns";

type CategoryFilter = "all" | "pilates" | "cycling" | "aerobics";
type HeatFilter = "all" | boolean;
type TimeFilter = "all" | "am" | "pm";
type ViewMode = "week" | "day";

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null); // 0-6 for Sun-Sat
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: sessions = [], isLoading } = useClassSessions({
    weekOffset,
    category: "all",
    isHeated: heatFilter,
  });

  const { data: bookings = [] } = useMyBookings();
  const bookedSessionIds = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => b.session_id);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 });

  // Generate week days for day selector
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      index: i,
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEE"),
      dayNum: format(date, "d"),
      month: format(date, "MMM"),
    };
  });

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    // Category filter
    if (categoryFilter !== "all") {
      const name = session.class_type.name.toLowerCase();
      
      if (categoryFilter === "pilates") {
        if (!name.includes("pilates") && !name.includes("reformer")) return false;
      }
      if (categoryFilter === "cycling") {
        if (!name.includes("cycle")) return false;
      }
      if (categoryFilter === "aerobics") {
        if (name.includes("pilates") || name.includes("cycle") || name.includes("reformer")) return false;
      }
    }

    // Time filter (AM/PM)
    if (timeFilter !== "all") {
      const startTime = parse(session.start_time, "HH:mm:ss", new Date());
      const hour = startTime.getHours();
      if (timeFilter === "am" && hour >= 12) return false;
      if (timeFilter === "pm" && hour < 12) return false;
    }

    // Day filter (when in day view or specific day selected)
    if (viewMode === "day" && selectedDayIndex !== null) {
      const selectedDate = format(addDays(weekStart, selectedDayIndex), "yyyy-MM-dd");
      if (session.session_date !== selectedDate) return false;
    }

    return true;
  });

  const handleBook = (session: ClassSession) => {
    setSelectedSession(session);
    setModalOpen(true);
  };

  const handleDaySelect = (dayIndex: number) => {
    if (viewMode === "day" && selectedDayIndex === dayIndex) {
      // If clicking same day in day view, switch to week view
      setViewMode("week");
      setSelectedDayIndex(null);
    } else {
      setSelectedDayIndex(dayIndex);
      setViewMode("day");
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-6 bg-secondary/30">
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

      <div className="container py-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setWeekOffset((prev) => Math.max(prev - 1, 0));
                setSelectedDayIndex(null);
                setViewMode("week");
              }}
              disabled={weekOffset === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              Week of {format(weekStart, "MMM d, yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setWeekOffset((prev) => Math.min(prev + 1, 2));
                setSelectedDayIndex(null);
                setViewMode("week");
              }}
              disabled={weekOffset >= 2}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode("week");
                setSelectedDayIndex(null);
              }}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Week
            </Button>
          </div>
        </div>

        {/* Day Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {weekDays.map((day) => {
            const isSelected = viewMode === "day" && selectedDayIndex === day.index;
            const isToday = format(new Date(), "yyyy-MM-dd") === day.dateStr;
            
            return (
              <Button
                key={day.index}
                variant={isSelected ? "default" : isToday ? "secondary" : "outline"}
                size="sm"
                className="flex-shrink-0 min-w-[70px] flex-col h-auto py-2"
                onClick={() => handleDaySelect(day.index)}
              >
                <span className="text-xs font-medium">{day.dayName}</span>
                <span className="text-lg font-bold">{day.dayNum}</span>
                <span className="text-xs">{day.month}</span>
              </Button>
            );
          })}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Category Filters */}
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

          <div className="w-px bg-border mx-1" />

          {/* Time Filters */}
          <Button
            variant={timeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("all")}
          >
            All Times
          </Button>
          <Button
            variant={timeFilter === "am" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("am")}
            className="gap-1"
          >
            <Sun className="h-4 w-4" />
            AM
          </Button>
          <Button
            variant={timeFilter === "pm" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("pm")}
            className="gap-1"
          >
            <Moon className="h-4 w-4" />
            PM
          </Button>

          <div className="w-px bg-border mx-1" />

          {/* Hot Filter */}
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

        {/* Calendar or Day View */}
        {viewMode === "week" ? (
          <ClassCalendar
            sessions={filteredSessions}
            isLoading={isLoading}
            onBook={handleBook}
            bookedSessionIds={bookedSessionIds}
            weekStartDate={weekStart}
          />
        ) : (
          <div className="space-y-3 max-w-2xl">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No classes match your filters for this day
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSessions
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((session) => {
                    const startTime = parse(session.start_time, "HH:mm:ss", new Date());
                    const spotsRemaining = session.max_capacity - session.current_enrollment;
                    const name = session.class_type.name.toLowerCase();
                    let categoryLabel = "Aerobics";
                    if (name.includes("pilates") || name.includes("reformer")) categoryLabel = "Pilates";
                    else if (name.includes("cycle")) categoryLabel = "Cycling";

                    return (
                      <div
                        key={session.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {session.class_type.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-secondary rounded">
                                {categoryLabel}
                              </span>
                              {session.class_type.is_heated && (
                                <span className="text-xs px-2 py-0.5 bg-destructive text-destructive-foreground rounded flex items-center gap-1">
                                  <Flame className="h-3 w-3" /> Hot
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-lg font-bold text-primary">
                            {format(startTime, "h:mm a")}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mb-3">
                          <div>50 min • {session.room}</div>
                          <div>{spotsRemaining} spots left</div>
                        </div>
                        <Button
                          onClick={() => handleBook(session)}
                          disabled={spotsRemaining <= 0 || bookedSessionIds.includes(session.id)}
                          variant={bookedSessionIds.includes(session.id) ? "secondary" : "default"}
                          size="sm"
                          className="w-full"
                        >
                          {bookedSessionIds.includes(session.id) 
                            ? "Booked" 
                            : spotsRemaining <= 0 
                            ? "Full" 
                            : "Book Class"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

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
