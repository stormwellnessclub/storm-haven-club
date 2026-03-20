import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User, Users, ChevronLeft, ChevronRight, CalendarDays, Check, Loader2 } from "lucide-react";
import { useClassTypeRatings } from "@/hooks/useClassReviews";
import { StarRating } from "@/components/reviews/StarRating";
import { startOfWeek, addDays, addWeeks, format, isSameDay, isBefore, startOfDay, parse, addMinutes } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTempClassBooking } from "@/hooks/useTempClassBooking";
import { useWaitlistStatus, useJoinWaitlist } from "@/hooks/useWaitlist";

interface LiveSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  current_enrollment: number;
  max_capacity: number;
  is_cancelled: boolean;
  is_hidden: boolean;
  room: string | null;
  class_type_id: string;
  instructor_id: string | null;
  class_types: {
    name: string;
    category: string;
    duration_minutes: number;
    image_url: string | null;
  };
  instructors: {
    first_name: string;
    last_name: string;
  } | null;
}

interface TempClassCardProps {
  session: LiveSession;
  readOnly?: boolean;
  isLoggedIn: boolean;
  canBook: boolean;
  isBooked: boolean;
  isBooking: boolean;
  isOnWaitlist: boolean;
  isJoiningWaitlist: boolean;
  onBook: () => void;
  onGetPass: () => void;
  onSignIn: () => void;
  onJoinWaitlist: () => void;
  ratingInfo?: { average_rating: number; review_count: number } | null;
}

function formatTime(dbTime: string): string {
  const d = parse(dbTime, "HH:mm:ss", new Date());
  return format(d, "h:mm a");
}

function TempClassCard({ session, readOnly, isLoggedIn, canBook, isBooked, isBooking, isOnWaitlist, isJoiningWaitlist, onBook, onGetPass, onSignIn, onJoinWaitlist, ratingInfo }: TempClassCardProps) {
  const isFull = session.current_enrollment >= session.max_capacity;
  const spotsLeft = session.max_capacity - session.current_enrollment;
  const instructorName = session.instructors
    ? `${session.instructors.first_name} ${session.instructors.last_name}`
    : null;

  const renderButton = () => {
    if (readOnly) return null;

    if (isBooked) {
      return (
        <Button size="sm" className="w-full" disabled variant="secondary">
          <Check className="h-4 w-4 mr-1" />
          Booked
        </Button>
      );
    }

    if (isFull) {
      if (!isLoggedIn) {
        return (
          <Button size="sm" className="w-full" variant="outline" onClick={onSignIn}>
            Sign In to Join Waitlist
          </Button>
        );
      }
      if (isOnWaitlist) {
        return (
          <Button size="sm" className="w-full" disabled variant="secondary">
            On Waitlist
          </Button>
        );
      }
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onJoinWaitlist} disabled={isJoiningWaitlist}>
          {isJoiningWaitlist ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          {isJoiningWaitlist ? "Joining..." : "Join Waitlist"}
        </Button>
      );
    }

    if (!isLoggedIn) {
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onSignIn}>
          Sign In to Book
        </Button>
      );
    }

    if (!canBook) {
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onGetPass}>
          Get a Pass
        </Button>
      );
    }

    return (
      <Button size="sm" className="w-full" onClick={onBook} disabled={isBooking}>
        {isBooking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        {isBooking ? "Booking..." : "Book Class"}
      </Button>
    );
  };

  return (
    <Card className={`group hover:shadow-md transition-shadow ${isBooked ? "border-primary/50 bg-primary/5" : ""}`}>
      {session.class_types.image_url && (
        <div className="h-24 overflow-hidden rounded-t-lg">
          <img
            src={session.class_types.image_url}
            alt={session.class_types.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {session.class_types.name}
            </h3>
            <Badge variant="secondary" className="text-xs mt-1">
              {session.class_types.category === "reformer" || session.class_types.category === "pilates_cycling"
                ? "Pilates"
                : session.class_types.category === "cycling"
                ? "Cycling"
                : "Aerobics"}
            </Badge>
            {ratingInfo && ratingInfo.review_count > 0 && (
              <div className="mt-1">
                <StarRating rating={ratingInfo.average_rating} size="sm" showValue count={ratingInfo.review_count} />
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{formatTime(session.start_time)}</span>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{session.class_types.duration_minutes} min</span></div>
          {instructorName && (
            <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{instructorName}</span></div>
          )}
          {session.room && (
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{session.room}</span></div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className={isFull ? "text-destructive font-medium" : ""}>
              {isFull ? "Class Full" : `${spotsLeft} of ${session.max_capacity} spots left`}
            </span>
          </div>
        </div>
        {renderButton()}
      </CardContent>
    </Card>
  );
}

export function TempClassSchedule({ readOnly = false, showHistory = false }: { readOnly?: boolean; showHistory?: boolean }) {
  const navigate = useNavigate();
  const { isLoggedIn, canBook, isBooked, bookClass, isBooking } = useTempClassBooking();

  const today = startOfDay(new Date());
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });

  const [weekOffset, setWeekOffset] = useState(0);
  const todayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, []);

  const weekStart = addWeeks(currentWeekStart, weekOffset);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  // Query live sessions from DB for the current week
  const { data: liveSessions = [] } = useQuery({
    queryKey: ["live-schedule-sessions", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, current_enrollment, max_capacity, is_cancelled, is_hidden, room, class_type_id, instructor_id, class_types!inner(name, category, duration_minutes, image_url), instructors(first_name, last_name)")
        .gte("session_date", weekStartStr)
        .lte("session_date", weekEndStr)
        .eq("is_cancelled", false)
        .eq("is_hidden", false)
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as LiveSession[];
    },
    refetchInterval: 30000,
  });

  // Group sessions by date
  const sessionsByDate = new Map<string, LiveSession[]>();
  liveSessions.forEach((s) => {
    const existing = sessionsByDate.get(s.session_date) || [];
    existing.push(s);
    sessionsByDate.set(s.session_date, existing);
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date,
      dateStr,
      dayName: format(date, "EEE"),
      dayNum: format(date, "d"),
      month: format(date, "MMM"),
      sessions: sessionsByDate.get(dateStr) || [],
      isToday: isSameDay(date, new Date()),
      isPast: isBefore(date, today),
    };
  });

  // Helper: check if a slot has ended
  function isSlotFinished(dateStr: string, startTime: string, durationMin: number): boolean {
    const slotStart = parse(`${dateStr} ${startTime}`, "yyyy-MM-dd HH:mm:ss", new Date());
    const slotEnd = addMinutes(slotStart, durationMin);
    return isBefore(slotEnd, new Date());
  }

  // Realtime subscription
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("live-schedule-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "class_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-schedule-sessions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Collect all session IDs for waitlist status check
  const allSessionIds = liveSessions.map((s) => s.id);
  const { data: waitlistMap = {} } = useWaitlistStatus(allSessionIds);
  const joinWaitlistMutation = useJoinWaitlist();
  const { data: ratingsMap = {} } = useClassTypeRatings();

  // Max weeks to navigate (12 weeks ahead)
  const maxWeekOffset = 12;
  const minWeekOffset = showHistory ? -12 : 0;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-primary/10 border-2 border-primary/40 rounded-xl py-5 px-6">
        <div className="flex items-start gap-4">
          <CalendarDays className="h-7 w-7 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-foreground">
              📅 Book Your Classes
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Browse available classes and reserve your spot.
            </p>
            <Link to="/class-passes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-2">
              Don't have a class pass? View class pass pricing
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((p) => Math.max(p - 1, minWeekOffset))} disabled={weekOffset <= minWeekOffset}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          Week of {format(weekStart, "MMM d, yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((p) => Math.min(p + 1, maxWeekOffset))} disabled={weekOffset >= maxWeekOffset}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const hidePast = day.isPast && !showHistory;

          // Filter visible sessions
          const visibleSessions = day.sessions.filter((s) => {
            if (hidePast) return false;
            if (!showHistory && isSlotFinished(day.dateStr, s.start_time, s.class_types.duration_minutes)) return false;
            return true;
          });

          return (
            <div key={day.dateStr} ref={day.isToday ? todayRef : undefined} className={`space-y-3 ${hidePast ? "opacity-40" : ""}`}>
              <div className={`text-center p-2 rounded-lg ${day.isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-xs font-medium uppercase">{day.dayName}</div>
                <div className="text-lg font-bold">{day.dayNum}</div>
                <div className="text-xs">{day.month}</div>
              </div>
              <div className="space-y-2">
                {hidePast ? (
                  <div className="text-center text-muted-foreground text-xs py-8">Past</div>
                ) : visibleSessions.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">No classes</div>
                ) : (
                  visibleSessions.map((session) => {
                    const slotFinished = isSlotFinished(day.dateStr, session.start_time, session.class_types.duration_minutes);
                    const timeFormatted = formatTime(session.start_time);

                    return (
                      <TempClassCard
                        key={session.id}
                        session={session}
                        readOnly={readOnly || day.isPast || slotFinished}
                        isLoggedIn={isLoggedIn}
                        canBook={canBook}
                        isBooked={isBooked(day.date, timeFormatted)}
                        isBooking={isBooking}
                        isOnWaitlist={!!waitlistMap[session.id]}
                        isJoiningWaitlist={joinWaitlistMutation.isPending}
                        onBook={() => bookClass({ className: session.class_types.name, date: day.date, time: timeFormatted })}
                        onGetPass={() => navigate("/class-passes")}
                        onSignIn={() => navigate("/auth")}
                        onJoinWaitlist={() => joinWaitlistMutation.mutate({ sessionId: session.id })}
                        ratingInfo={ratingsMap[session.class_type_id] || null}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {!readOnly && 'Click "Book Class" to reserve your spot.'}
      </p>
    </div>
  );
}
