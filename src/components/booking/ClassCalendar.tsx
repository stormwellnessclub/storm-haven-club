import { useMemo } from "react";
import { ClassSession } from "@/hooks/useClassSessions";
import { ClassCard } from "./ClassCard";
import { format, parseISO, addDays, isBefore, startOfDay, isToday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassTypeRatings } from "@/hooks/useClassReviews";

interface ClassCalendarProps {
  sessions: ClassSession[];
  isLoading: boolean;
  onBook: (session: ClassSession) => void;
  bookedSessionIds: string[];
  weekStartDate: Date;
  bookingDisabled?: boolean;
}

export function ClassCalendar({
  sessions,
  isLoading,
  onBook,
  bookedSessionIds,
  weekStartDate,
  bookingDisabled = false,
}: ClassCalendarProps) {
  const { data: ratingsMap } = useClassTypeRatings();

  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc, session) => {
    const date = session.session_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, ClassSession[]>);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Generate all 7 days of the week, but only show today and future
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStartDate, i);
      return format(date, "yyyy-MM-dd");
    }).filter((dateStr) => {
      const date = parseISO(dateStr);
      return !isBefore(date, today) || isToday(date);
    });
  }, [weekStartDate, today]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((date) => (
          <div key={date} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
      {weekDays.map((dateStr) => {
        const date = parseISO(dateStr);
        const daySessions = sessionsByDate[dateStr] || [];
        const todayHighlight = format(new Date(), "yyyy-MM-dd") === dateStr;

        return (
          <div key={dateStr} className="space-y-3">
            <div
              className={`text-center p-2 rounded-lg border ${
                todayHighlight
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 border-border"
              }`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                {format(date, "EEE")}
              </div>
              <div className="text-xl font-serif leading-tight mt-0.5">{format(date, "d")}</div>
              <div className="text-[10px] opacity-70">{format(date, "MMM")}</div>
            </div>


            <div className="space-y-2">
              {daySessions.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No classes
                </div>
              ) : (
                daySessions.map((session) => {
                  const r = ratingsMap?.[session.class_type?.id];
                  return (
                    <ClassCard
                      key={session.id}
                      session={session}
                      bookingDisabled={bookingDisabled}
                      onBook={onBook}
                      isBooked={bookedSessionIds.includes(session.id)}
                      rating={r ? { average: r.average_rating, count: r.review_count } : null}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
