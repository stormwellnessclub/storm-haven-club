import { ClassSession } from "@/hooks/useClassSessions";
import { ClassCard } from "./ClassCard";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassCalendarProps {
  sessions: ClassSession[];
  isLoading: boolean;
  onBook: (session: ClassSession) => void;
  bookedSessionIds: string[];
  weekStartDate: Date;
}

export function ClassCalendar({
  sessions,
  isLoading,
  onBook,
  bookedSessionIds,
  weekStartDate,
}: ClassCalendarProps) {
  // Group sessions by date
  const sessionsByDate = sessions.reduce((acc, session) => {
    const date = session.session_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, ClassSession[]>);

  // Generate all 7 days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    return format(date, "yyyy-MM-dd");
  });

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
        const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
        const isPast = date < new Date() && !isToday;

        return (
          <div
            key={dateStr}
            className={`space-y-3 ${isPast ? "opacity-50" : ""}`}
          >
            <div
              className={`text-center p-2 rounded-lg ${
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <div className="text-xs font-medium uppercase">
                {format(date, "EEE")}
              </div>
              <div className="text-lg font-bold">{format(date, "d")}</div>
              <div className="text-xs">{format(date, "MMM")}</div>
            </div>

            <div className="space-y-2">
              {daySessions.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No classes
                </div>
              ) : (
                daySessions.map((session) => (
                  <ClassCard
                    key={session.id}
                    session={session}
                    onBook={onBook}
                    isBooked={bookedSessionIds.includes(session.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
